var Colorpicker = function() {
    var config = {
        sq: 210,
        scale: 2,
        mode: 'hcl',
        x: '',
        y: '',
        z: '',
        zval: 0.5
    };
    this.init(config);
};

Colorpicker.prototype = {
    colorArray: [],
    init: function(config) {
        var that = this;
        var getctx = function(id) {return document.getElementById(id).getContext('2d'); };
        var Color = chroma.Color;
        var changeMode = function(mode) {
            config.mode = mode;
            var modeopt = colorspace[mode];
            var i;
            config.opt = modeopt;

            $('.axis-select a').remove();
            for (i = 0; i < modeopt.axis.length; i++) {
                var ax = modeopt.axis[i];
                var title = modeopt.labels[i];
                var a = $('<li><a href="#" rel="tooltip" class="' + ax + '" title="' + title + '" data-axis="' + ax + '">' + ax[0] + '&#8211;' + ax[1] + '</a></li>');
                $('.axis-select').append(a);
            }
            $('.axis-select a').click(changeAxisClick);
        };

        var changeAxisClick = function(e) {
            updateAxis($(e.target).data('axis'));
            resetGradient();
            config.zval = config.zdim[4];
            renderColorSpace();
            showGradient();
            return false;
        };

        var colorspace = {
            'hcl': {
                dimensions: [
                    ['h', 'hue', 0,360,0],
                    ['c', 'chroma', 0,5,1],
                    ['l', 'lightness', 0,1.7,0.6]],
                axis: ['hlc', 'clh', 'hcl'],
                labels: ['Hue/Lightness', 'Chroma/Lightness', 'Hue/Chroma']
            }
        };

        var getColor = function(x,y) {
            var xyz = [];
            var dx = config.dx;
            var dy = config.dy;
            var dz = config.dz;

            xyz[dx] = x;
            xyz[dy] = y;
            xyz[dz] = config.zval;

            return new Color(xyz, config.mode);
        };

        var bgimg;
        var renderColorSpace = function() {
            var x, y, xv, color, idx,
                dx = config.dx,
                dy = config.dy,
                xdim = config.xdim,
                ydim=config.ydim,
                sq = config.sq,
                ctx = getctx('colorspace'),
                imdata = ctx.createImageData(sq,sq);

            for (x=0; x < sq; x++) {
                for (y=0; y < sq; y++) {

                    idx = (x + y * imdata.width) * 4;
                    xv = xdim[2] + (x/sq) * (xdim[3] - xdim[2]);
                    yv = ydim[2] + (y/sq) * (ydim[3] - ydim[2]);

                    color = getColor(xv, yv).rgb;

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
        };

        var updateAxis = function(axis) {
            config.x = axis[0];
            config.y = axis[1];
            config.z = axis[2];

            $('.axis-select a').removeClass('active');
            $('.axis-select').find('[data-axis="' + axis + '"]').addClass('active');

            var i;

            for (i = 0; i < config.opt.dimensions.length; i++) {
                var dim = config.opt.dimensions[i];
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
            $('#sl-val').html('<span>' + $('#sl-z').slider('value') + '</span>' + axis[2]);
        };

        var setView = function(mode, axis, reset) {
            changeMode(mode);
            updateAxis(axis);
            renderColorSpace();
            showGradient();
        };

        var unserialize = function(hash) {
            if (!hash) {
                // default init settings
                return {
                    swatches: 6,
                    axis: colorspace['hcl'].axis[0],
                    from: [0,1],
                    to: [1, 0.5]
                };
            }
            var parts = hash.split('/'),
                zval = Number(parts[2]);
            config.zval = zval;
            $('#sl-val span').html(zval);
            updateAxis(parts[0]);
            return {
                swatches: Number(parts[1]),
                axis: parts[0],
                from: getXY(new Color(parts[3])),
                to: getXY(new Color(parts[4]))
            };
        };

        var getXY = function(color) {
            // inverse operation to getColor
            var hcl = color.hcl(),
                x = hcl[config.dx],
                y = hcl[config.dy];
            return [x, y];
        };

        $('#sl-z').slider({
            range: 'min',
            step: 0.01,
            value: 0.5,
            slide: function(event, ui) {
                $('#sl-val span').html(ui.value);
                config.zval = ui.value;
                renderColorSpace();
            }
        });

        var hash = location.href.split('#/')[1];
        changeMode('hcl');
        var state = unserialize(hash);

        var swatches = state.swatches;
        var gradient = {
            from: state.from,
            to: state.to, //x,y
            steps: swatches,
            handlesize: 10
        };

        $('#controls a').click(function () {
            var operation = $(this).attr('data-type');
            if (operation == 'add') {
                swatches = swatches + 1;
                gradient.steps = swatches;
                showGradient();
            }
            if (operation == 'subtract') {
                if (swatches != 1) {
                swatches = swatches - 1;
                gradient.steps = swatches;
                showGradient();
                }
            }
            return false;
        });

        var resetGradient = function() {
            gradient.from[0] = config.xdim[2] + (config.xdim[3]-config.xdim[2]) * (23/36);
            gradient.from[1] = config.ydim[2] + (config.ydim[3]-config.ydim[2]) * 0.1;
            gradient.to[0] = config.xdim[2] + (config.xdim[3]-config.xdim[2]) * (8/36);
            gradient.to[1] = config.ydim[2] + (config.ydim[3]-config.ydim[2]) * 0.8;
        };

        var showGradient = function(from) {
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
            ctx.rect(x0-a,y0-a,a*2,a*2);
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            col_t = getColor(gradient.to[0],gradient.to[1]).hex();
            ctx.fillStyle= col_t;
            ctx.rect(x1-a,y1-a,a*2,a*2);
            ctx.fill();
            ctx.stroke();

            colors.push(col_f);

            for (i = 1; i < gradient.steps-1; i++) {
                fx = gradient.from[0] + (i/(gradient.steps-1)) * (gradient.to[0]-gradient.from[0]);
                fy = gradient.from[1] + (i/(gradient.steps-1)) * (gradient.to[1]-gradient.from[1]);
                x = toX(fx, config.xdim) + 10;
                y = toX(fy, config.ydim) + 10;

                ctx.beginPath();
                ctx.strokeStyle = 'rgba(255,255,255,0.25)';
                col = getColor(fx,fy).hex();
                colors.push(col);
                ctx.fillStyle = col;
                ctx.rect(x-b,y-b,b*2,b*2);
                ctx.fill();
                ctx.stroke();
            }
            colors.push(col_t);

            $('#visual-output .swatch').remove();
            $('#code-output').empty();
            that.colorArray = [];

            var textarea = $('#code-output');
            for (i = 0; i < colors.length; i++) {
                // Color Swatches
                var swatch = $('<div class="swatch" />');
                swatch.css({ background: colors[i] });
                that.colorArray.push(colors[i]);
                $('#visual-output').append(swatch);

                // Code Snippet
                textarea.append('<span class"value">' + colors[i] + '</span>');
            }
            textarea.bind('click', function() {
                if (document.selection) {
                    var rangeD = document.body.createTextRange();
                        rangeD.moveToElementText(document.getElementById('code-output'));
                    rangeD.select();
                    }
                else if (window.getSelection) {
                    var rangeW = document.createRange();
                        rangeW.selectNode(document.getElementById('code-output'));
                    window.getSelection().addRange(rangeW);
                }
                return false;
            });

            location.href= '#/'+serialize();
        };

        var serialize = function() {
            return config.x+config.y+config.z+'/'+
                gradient.steps+'/'+
                config.zval+'/'+
                getColor(gradient.from[0], gradient.from[1]).hex().substr(1)+'/'+
                getColor(gradient.to[0], gradient.to[1]).hex().substr(1);
        };

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
            }
        });


        var mode = 'hcl';
        var axis = state.axis;

        setView(mode, axis);

        showGradient();

    }
};
