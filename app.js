function loading(state) {
    var opts = {
        lines: 15,
        length: 5,
        width: 5,
        radius: 20,
        color: '#FFF',
        speed: 2,
        trail: 100,
        top: 'auto',
        left: 'auto'
    };

    var target = $('#load');
    if (!this.spinner) this.spinner = new Spinner();
    if (!this.active) this.active = false;

    switch(state) {
        case 'start':
            if(!this.active) {
                this.spinner = Spinner(opts).spin();
                target
                    .append(this.spinner.el)
                    .addClass('active');

                this.active = true;
            }
            break;

        case 'stop':
            if (this.spinner) {
                target.removeClass('active');
                this.spinner.stop();
                this.active = false;
            }
            break;
    }
}

var colorspace = {
    'hcl': {
        dimensions: [
            ['h', 'hue', 0, 360, 0],
            ['c', 'chroma', 0, 5, 1],
            ['l', 'lightness', 0, 1.7, 0.6]],
        axis: [
            ['hlc', 'hue-lightness'],
            ['clh', 'chroma-lightness'],
            ['hcl', 'hue-chroma']]
    }
};

var Color = chroma.Color;

function Colorpicker() {
    var config = {
        sq: 210,
        scale: 2,
        axis: 'hcl',
        opt: colorspace.hcl,
        x: '',
        y: '',
        z: '',
        zval: 1
    };
    this.init(config);
}

Colorpicker.prototype = {
    colorArray: [],
    init: function(config) {

        function getctx(id) {
            return document.getElementById(id).getContext('2d');
        }

        function getColor(x,y) {
            var xyz = [];

            xyz[config.dx] = x;
            xyz[config.dy] = y;
            xyz[config.dz] = config.zval;

            var c = new Color(xyz, 'hcl');
            return c;
        }

        function renderColorSpace() {
            var x, y, xv, yv, color, idx,
                dx = config.dx,
                dy = config.dy,
                xdim = config.xdim,
                ydim = config.ydim,
                sq = config.sq,
                ctx = getctx('colorspace'),
                imdata = ctx.createImageData(sq, sq);

            for (x = 0; x < sq; x++) {
                for (y = 0; y < sq; y++) {

                    idx = (x + y * imdata.width) * 4;

                    // TODO use the xv commented out to double the colorspace and
                    // allow the drag handles to move from violet to red
                    // TODO Condition this. If the axis is H-L then make this value larger
                    // xv = xdim[2] + ((x/sq) * 2) * (xdim[3] - xdim[2]);

                    xv = xdim[2] + (x/sq) * (xdim[3] - xdim[2]);
                    yv = ydim[2] + (y/sq) * (ydim[3] - ydim[2]);

                    color = getColor(xv, yv);
                    if (isNaN(color[0])) {
                        imdata.data[idx] = 255;
                        imdata.data[idx+1] = 0;
                        imdata.data[idx+2] = 0;
                        imdata.data[idx+3] = 0;
                    } else {
                        imdata.data[idx] = color[0];
                        imdata.data[idx+1] = color[1];
                        imdata.data[idx+2] = color[2];
                        imdata.data[idx+3] = 255;
                    }
                }
            }
            ctx.putImageData(imdata, 0,0);
            showGradient();
        }

        function updateAxis(axis) {
            config.x = axis[0];
            config.y = axis[1];
            config.z = axis[2];

            var i;

            for (i = 0; i < colorspace.hcl.dimensions.length; i++) {
                var dim = colorspace.hcl.dimensions[i];
                if (dim[0] === config.x) {
                    config.dx = i;
                    config.xdim = dim;
                } else if (dim[0] === config.y) {
                    config.dy = i;
                    config.ydim = dim;
                } else if (dim[0] === config.z) {
                    config.dz = i;
                    config.zdim = dim;
                }
            }

            $('#sl-z').slider({
                min: config.zdim[2],
                max: config.zdim[3],
                step: config.zdim[3] > 99 ? 1 : 0.01,
                value: config.zval
            });

            $('label[for=val-z]').html(config.zdim[1]);

            var handle = $('#sl-z .ui-slider-handle');
                handle.attr('rel', 'tooltip').attr('title', 'Adjust ' + config.zdim[1]);

            $('#sl-val').html('<span>' + $('#sl-z').slider('value') + '</span>' + axis[2]);
        }

        function setView(state, reset) {
            updateAxis(state.axis);
            config.zval = config.zdim[4];
            renderColorSpace();
            resetGradient();
            showGradient();
        }

        function getXY(color) {
            // inverse operation to getColor
            var hcl = color.hcl();
            return [hcl[config.dx], hcl[config.dy]];
        }

        $('#sl-z').slider({
            range: 'min',
            step: 0.01,
            value: 1,
            slide: function(event, ui) {
                $('.tooltip').remove();
                $('#sl-val span').html(ui.value);
                config.zval = ui.value;
                renderColorSpace();
            }
        });

        $('#controls a').click(function() {
            var operation = $(this).attr('data-type');
            if (operation === 'add') {
                swatches = swatches + 1;
                gradient.steps = swatches;
                showGradient();
            } else if (operation === 'subtract') {
                if (swatches != 1) {
                    swatches = swatches - 1;
                    gradient.steps = swatches;
                    showGradient();
                }
            }
            return false;
        });

        function resetGradient() {
            gradient.from[0] = config.xdim[2] + (config.xdim[3]-config.xdim[2]) * (23/36);
            gradient.from[1] = config.ydim[2] + (config.ydim[3]-config.ydim[2]) * 0.1;
            gradient.to[0] = config.xdim[2] + (config.xdim[3]-config.xdim[2]) * (8/36);
            gradient.to[1] = config.ydim[2] + (config.ydim[3]-config.ydim[2]) * 0.8;
        }

        function showGradient(from) {
            // draw line
            var colors = [], col_f, col_t, col;
            var toX = function(v, dim) {
                return Math.round((v - dim[2])/(dim[3]-dim[2])*config.sq*config.scale)-0.5;
            };
            var a = gradient.handlesize,
                b = Math.floor(gradient.handlesize*0.65), i, fx, fy, x, y;
            var x0 = toX(gradient.from[0], config.xdim)+10,
                x1 = toX(gradient.to[0], config.xdim)+10,
                y0 = toX(gradient.from[1], config.ydim)+10,
                y1 = toX(gradient.to[1], config.ydim)+10,

            ctx = getctx('grad');
            ctx.clearRect(0,0,600,600);

            $('.drag.from').css({
                width: (a*2)+'px',
                height: (a*2)+'px',
                left: (x0-a)+'px',
                top: (y0-a)+'px'
            });

            if (!from) {
                $('.drag.to').css({
                    width: (a*2)+'px',
                    height: (a*2)+'px',
                    left: (x1-a)+'px',
                    top: (y1-a)+'px'
                });
            }

            ctx.beginPath();
            ctx.strokeStyle='rgba(255,255,255,0.25)';
            ctx.moveTo(x0,y0);
            ctx.lineTo(x1,y1);
            ctx.stroke();

            ctx.beginPath();
            ctx.strokeStyle='#fff';
            col_f = getColor(gradient.from[0],gradient.from[1]).hex();
            ctx.fillStyle = col_f;
            ctx.arc(x0, y0, a, 0, Math.PI*2);
            ctx.fill();
            ctx.closePath();
            ctx.stroke();

            ctx.beginPath();
            col_t = getColor(gradient.to[0],gradient.to[1]).hex();
            ctx.fillStyle= col_t;
            ctx.arc(x1, y1, a, 0, Math.PI*2);
            ctx.fill();
            ctx.closePath();
            ctx.stroke();

            colors.push(col_f);

            for (i = 1; i < gradient.steps-1; i++) {
                fx = gradient.from[0] + (i/(gradient.steps-1)) * (gradient.to[0]-gradient.from[0]);
                fy = gradient.from[1] + (i/(gradient.steps-1)) * (gradient.to[1]-gradient.from[1]);
                x = toX(fx, config.xdim[2]) + 10;
                y = toX(fy, config.ydim[2]) + 10;

                ctx.beginPath();
                ctx.strokeStyle = 'rgba(255,255,255,0.25)';
                col = getColor(fx, fy).hex();
                colors.push(col);
                ctx.fillStyle = col;
                ctx.arc(x, y, b, 0, Math.PI*2);
                ctx.fill();
                ctx.closePath();
                ctx.stroke();
            }

            colors.push(col_t);

            updateSwatches(colors);

            location.href = '#/' + serialize();
        }

        function updateSwatches(colors) {
            ['#visual-output', '#legend-output'].forEach(function(id) {
                var output = d3.select(id)
                    .selectAll('div.swatch').data(colors);
                output.exit().remove();
                output.enter().append('div').attr('class', 'swatch');
                output.style('background', String);
            });

            var output = d3.select('#code-output')
                .selectAll('span.value').data(colors);
            output.exit().remove();
            output.enter().append('span').attr('class', 'value')
                .on('click', selectThis);
            output.text(String);
        }

        function selectThis() {
            if (document.selection) {
                var rangeD = document.body.createTextRange();
                    rangeD.moveToElementText(this);
                rangeD.select();
            } else if (window.getSelection) {
                var rangeW = document.createRange();
                    rangeW.selectNode(this);
                window.getSelection().addRange(rangeW);
            }
        }

        function unserialize(hash) {
            if (!hash) {
                // default init settings
                return {
                    swatches: 6,
                    axis: colorspace.hcl.axis[0],
                    from: [0, 1],
                    to: [1, 0.6]
                };
            }
            var parts = hash.split('/'),
                zval = Number(parts[2]);
            config.zval = zval;
            $('#sl-val span').html(zval);
            return {
                swatches: Number(parts[1]),
                axis: parts[0],
                from: getXY(new Color(parts[3])),
                to: getXY(new Color(parts[4]))
            };
        }

        function serialize() {
            return config.x + config.y+config.z + '/' +
                gradient.steps + '/' +
                config.zval + '/' +
                getColor(gradient.from[0], gradient.from[1]).hex().substr(1) + '/' +
                getColor(gradient.to[0], gradient.to[1]).hex().substr(1);
        }

        $('.drag').draggable({
            containment: 'parent',
            drag: function(event, ui) {
                var from = $(event.target).hasClass('from'),
                    x = ui.position.left + gradient.handlesize-10,
                    y = ui.position.top + gradient.handlesize-10,
                    xv = x / (config.sq*config.scale) * (config.xdim[3]-config.xdim[2]) + config.xdim[2],
                    yv = y / (config.sq*config.scale) * (config.ydim[3]-config.ydim[2]) + config.ydim[2];

                xv = Math.min(config.xdim[3], Math.max(config.xdim[2], xv));
                yv = Math.min(config.ydim[3], Math.max(config.ydim[2], yv));

                if (from) {
                    gradient.from = [xv,yv];
                    showGradient(from);
                } else {
                    gradient.to = [xv,yv];
                    showGradient();
                }

                // TODO Move the parent position of the color canvas
                // if (ui.position.left === 410) {
                //    console.log();
                // }
            }
        });

        function axisLinks() {
            var axis_links = d3.select('.axis-select')
                .selectAll('li')
                .data(colorspace.hcl.axis);

            axis_links.exit().remove();
            axis_links.enter().append('li');

            var alink = axis_links.selectAll('a');

            alink.data(function(d) { return [d]; })
                .enter().append('a')
                .attr({
                    href: '#',
                    'class': function(d) { return 'axis-select ' + d[0]; },
                    'title': function(d) { return d[1]; },
                    rel: 'tooltip'
                })
                .classed('active', function(d) {
                    return d[0] == config.axis;
                })
                .text(function(d) { return d[0][0] + '–' + d[0][1]; })
                .on('click', function(d) {
                    updateAxis(d[0]);
                    resetGradient();
                    renderColorSpace();
                    showGradient();
                    d3.selectAll('a.axis-select').classed('active', function(_) {
                        return _[0] == d[0];
                    });
                    return d3.event.preventDefault();
                });
        }

        var hash = location.hash.slice(2),
            state = unserialize(hash),
            swatches = state.swatches;

        var gradient = {
            from: state.from,
            to: state.to, //x,y
            steps: swatches,
            handlesize: 15
        };

        config.axis = state.axis;
        setView(state);
        axisLinks();
        showGradient();
    }
};
