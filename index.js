'use strict';
/*eslint-disable no-new */

var clipboard = require('clipboard');
var extend = require('xtend');
var chroma = require('chroma-js');
var debounce = require('lodash.debounce');
var d3 = require('d3');
d3.geo = require('d3-geo').geo;

var HUE_SHIFT = 130;

function autoscale(canvas) {
  var ctx = canvas.getContext('2d');
  var ratio = window.devicePixelRatio || 1;
  if (ratio !== 1) {
    canvas.style.width = canvas.width + 'px';
    canvas.style.height = canvas.height + 'px';
    canvas.width *= ratio;
    canvas.height *= ratio;
    ctx.scale(ratio, ratio);
  }
  return ctx;
}

function unserialize(hash) {
  var parts = hash.split('/');
  return {
    axis: parts[0],
    steps: Number(parts[1]),
    zval: Number(parts[2]),
    from: chroma(parts[3]),
    to: chroma(parts[4]),
    hueShift: Number(parts[5]) || HUE_SHIFT
  };
}

function Colorpicker(options) {
  var defaults = {
    sq: 210,
    scale: 2,
    handleSize: 15,
    axis: 'hlc',
    hueShift: HUE_SHIFT,
    colorspace: {
      dimensions: [
        ['h', 'hue', 0, 360, 0],
        ['c', 'chroma', 0, 135, 60],
        ['l', 'lightness', 0, 100, 50]
      ],
      axis: [
        ['hlc', 'hue-lightness'],
        ['clh', 'chroma-lightness'],
        ['hcl', 'hue-chroma']
      ]
    },
    x: 'h',
    y: 'l',
    z: 'c',
    steps: 6,
    zval: 64,
    from: chroma(0x351b7e),
    to: chroma(0xe0fe7e)
  };

  var hash = location.hash.slice(2) ? unserialize(location.hash.slice(2)) : {};
  this.init(extend(defaults, options, hash));
}

Colorpicker.prototype = {
  init: function(options) {
    var initPosSet = false;
    var slider = d3.select('#slider');
    var sliderHue = d3.select('#slider-hue');

    updateAxis(options.axis);
    options.from = getXY(options.from);
    options.to = getXY(options.to);

    d3
      .select('#sl-val')
      .select('span')
      .html(options.zval);

    function getctx(id) {
      return document.getElementById(id).getContext('2d');
    }

    function getretinactx(id) {
      return autoscale(document.getElementById(id));
    }

    function getColor(x, y) {
      var xyz = [];
      xyz[options.dx] = x;
      xyz[options.dy] = y;
      if (typeof options.zval == 'string') {
        xyz[options.dz] = parseFloat(options.zval);
      } else {
        xyz[options.dz] = options.zval;
      }
      var c = chroma.hcl(xyz);
      return c;
    }

    var colorctx = getctx('colorspace');

    function renderColorSpace() {
      var xdim = options.xdim,
        ydim = options.ydim,
        sq = options.sq,
        ctx = colorctx,
        imdata = ctx.createImageData(sq, sq);

      for (var x = 0; x < sq; x++) {
        for (var y = 0; y < sq; y++) {
          var idx = (x + y * imdata.width) * 4;

          var xv = xdim[2] + x / sq * (xdim[3] - xdim[2]);
          var yv = ydim[2] + y / sq * (ydim[3] - ydim[2]);

          var color = getColor(xv, yv);
          if (color.clipped()) {
            imdata.data[idx] = 255;
            imdata.data[idx + 1] = 0;
            imdata.data[idx + 2] = 0;
            imdata.data[idx + 3] = 0;
          } else {
            var rgb = color.rgb();
            imdata.data[idx] = rgb[0];
            imdata.data[idx + 1] = rgb[1];
            imdata.data[idx + 2] = rgb[2];
            imdata.data[idx + 3] = 255;
          }
        }
      }
      ctx.putImageData(imdata, 0, 0);
      showGradient();
    }

    function updateAxis(axis) {
      options.x = axis[0];
      options.y = axis[1];
      options.z = axis[2];

      for (var i = 0; i < options.colorspace.dimensions.length; i++) {
        var dim = options.colorspace.dimensions[i];
        if (dim[0] === 'h') {
          dim = dim.slice();
          dim[2] -= options.hueShift;
          dim[3] -= options.hueShift;
        }
        if (dim[0] === options.x) {
          options.dx = i;
          options.xdim = dim;
        } else if (dim[0] === options.y) {
          options.dy = i;
          options.ydim = dim;
        } else if (dim[0] === options.z) {
          options.dz = i;
          options.zdim = dim;
        }
      }

      slider
        .attr('min', options.zdim[2])
        .attr('max', options.zdim[3])
        .attr('step', options.zdim[3] > 99 ? 1 : 0.01)
        .attr('value', options.zval);

      d3.select('.js-slider-title').text(options.zdim[1]);

      d3.select('.js-slider-value').text(formatZValue());

      sliderHue
        .attr('min', -180)
        .attr('max', 180)
        .attr('value', options.hueShift);
      d3.select('.js-slider-hue-value').text(options.hueShift);
    }

    function fixAngle(angle, min, max) {
      while (angle < min) angle += 360;
      while (angle >= max) angle -= 360;
      return angle;
    }

    function fixAngleIfNeeded(value, dim) {
      if (dim[0] === 'h') {
        value = fixAngle(value, dim[2], dim[3]);
      }
      return value;
    }

    function formatZValue() {
      var zval = options.zval;
      if (options.zdim[0] === 'h') {
        zval = fixAngle(zval, 0, 360);
      }
      return zval;
    }

    function setView(axis) {
      updateAxis(axis);
      renderColorSpace();
      showGradient();
    }

    function getXY(color) {
      // inverse operation to getColor
      var hcl = color.hcl();
      return [
        fixAngleIfNeeded(hcl[options.dx], options.xdim),
        fixAngleIfNeeded(hcl[options.dy], options.ydim)
      ];
    }

    var DEBOUNCE_MILLISECONDS = 10;
    var debouncedRenderColorSpace = debounce(
      renderColorSpace,
      DEBOUNCE_MILLISECONDS
    );
    var debouncedRenderUpdateAxisAndRenderColorSpace = debounce(function() {
      d3.select('.js-slider-hue-value').text(options.hueShift);
      updateAxis(options.axis);
      renderColorSpace();
    }, DEBOUNCE_MILLISECONDS);

    var SLIDER_EVENT = window.oninput ? 'input' : 'mousemove';

    slider.on(SLIDER_EVENT, function() {
      options.zval = this.value;
      d3.select('.js-slider-value').text(formatZValue());
      debouncedRenderColorSpace();
    });

    sliderHue.on(SLIDER_EVENT, function() {
      options.hueShift = +this.value;
      debouncedRenderUpdateAxisAndRenderColorSpace();
    });

    d3.select('.js-add').on('click', function() {
      options.steps = options.steps + 1;
      showGradient();
    });

    d3.select('.js-subtract').on('click', function() {
      if (options.steps !== 1) {
        options.steps = options.steps - 1;
        showGradient();
      }
    });

    function resetGradient() {
      options.from[0] =
        options.xdim[2] + (options.xdim[3] - options.xdim[2]) * (23 / 36);
      options.from[1] =
        options.ydim[2] + (options.ydim[3] - options.ydim[2]) * 0.1;
      options.to[0] =
        options.xdim[2] + (options.xdim[3] - options.xdim[2]) * (8 / 36);
      options.to[1] =
        options.ydim[2] + (options.ydim[3] - options.ydim[2]) * 0.8;
    }

    var gradctx = getretinactx('grad');

    function showGradient() {
      // draw line
      var colors = [],
        col_f,
        col_t,
        col;
      var toX = function(v, dim) {
        return (
          Math.round(
            (v - dim[2]) / (dim[3] - dim[2]) * options.sq * options.scale
          ) - 0.5
        );
      };

      var a = options.handleSize;
      var b = Math.floor(options.handleSize * 0.65);
      var x0 = toX(options.from[0], options.xdim) + 10;
      var x1 = toX(options.to[0], options.xdim) + 10;
      var y0 = toX(options.from[1], options.ydim) + 10;
      var y1 = toX(options.to[1], options.ydim) + 10;

      var ctx = gradctx;
      ctx.clearRect(0, 0, 600, 600);

      if (!initPosSet) {
        d3.select('.drag.from').style({
          left: x0 - a + 'px',
          top: y0 - a + 'px'
        });
        d3.select('.drag.to').style({
          left: x1 - a + 'px',
          top: y1 - a + 'px'
        });
      }

      // The line that connects the two circular
      // drag controls on the colorpicker.
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();

      function drawCircle(x, y, r, color, strokeColor) {
        ctx.beginPath();
        ctx.strokeStyle = color.clipped() ? '#f00' : strokeColor;
        ctx.fillStyle = color.hex();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
        ctx.stroke();
      }

      // `from` drag control on the colorpicker.
      col_f = getColor(options.from[0], options.from[1]);
      drawCircle(x0, y0, a, col_f, '#fff');

      // `to` drag control on the colorpicker.
      col_t = getColor(options.to[0], options.to[1]);
      drawCircle(x1, y1, a, col_t, '#fff');

      colors.push(col_f);

      for (var i = 1; i < options.steps - 1; i++) {
        var fx =
          options.from[0] +
          i / (options.steps - 1) * (options.to[0] - options.from[0]);
        var fy =
          options.from[1] +
          i / (options.steps - 1) * (options.to[1] - options.from[1]);
        var x = toX(fx, options.xdim) + 10;
        var y = toX(fy, options.ydim) + 10;

        col = getColor(fx, fy);
        drawCircle(x, y, b, col, 'rgba(255,255,255,0.5)');
        colors.push(col);
      }

      colors.push(col_t);
      updateSwatches(colors);

      // Update the url hash
      location.href = '#/' + serialize();
    }

    function updateSwatches(colors) {
      ['#visual-output', '#legend-output'].forEach(function(id) {
        var output = d3
          .select(id)
          .selectAll('div.swatch')
          .data(colors);
        output.exit().remove();
        output
          .enter()
          .append('div')
          .attr('class', 'swatch');
        output.style('background', String);
        output.attr('title', function(color) {
          var lch = color.lch();
          return (
            'L=' +
            Math.round(lch[0]) +
            '\nC=' +
            Math.round(lch[1]) +
            '\nH=' +
            Math.round(lch[2])
          );
        });
      });

      if (options.callback) options.callback(colors);
      var output = d3
        .select('#code-output')
        .selectAll('span.value')
        .data(colors);

      output.exit().remove();
      output
        .enter()
        .append('span')
        .attr('class', 'value');
      output.text(String);
      output.style('color', function(color) {
        return color.clipped() ? '#b00' : 'inherit';
      });
    }

    function serialize() {
      return (
        options.x +
        options.y +
        options.z +
        '/' +
        options.steps +
        '/' +
        options.zval +
        '/' +
        getColor(options.from[0], options.from[1])
          .hex()
          .substr(1) +
        '/' +
        getColor(options.to[0], options.to[1])
          .hex()
          .substr(1) +
        '/' +
        options.hueShift
      );
    }

    var drag = d3.behavior
      .drag()
      .origin(Object)
      .on('drag', function() {
        initPosSet = true;

        var posX = parseInt(d3.select(this).style('left'), 10);
        var posY = parseInt(d3.select(this).style('top'), 10);

        // 440 = width of container. 30 = width of drag circle.
        posX = Math.max(0, Math.min(440 - 30, posX + d3.event.dx));
        // 440 = height of container. 30 = height of drag circle.
        posY = Math.max(0, Math.min(440 - 30, posY + d3.event.dy));

        d3.select(this).style({
          left: posX + 'px',
          top: posY + 'px'
        });

        var from = d3.select(this).classed('from');
        var x = posX + options.handleSize - 10;
        var y = posY + options.handleSize - 10;
        var xv =
          x /
            (options.sq * options.scale) *
            (options.xdim[3] - options.xdim[2]) +
          options.xdim[2];
        var yv =
          y /
            (options.sq * options.scale) *
            (options.ydim[3] - options.ydim[2]) +
          options.ydim[2];

        xv = Math.min(options.xdim[3], Math.max(options.xdim[2], xv));
        yv = Math.min(options.ydim[3], Math.max(options.ydim[2], yv));

        if (from) {
          options.from = [xv, yv];
        } else {
          options.to = [xv, yv];
        }

        showGradient();
      });
    d3.select('.drag.to').call(drag);
    d3.select('.drag.from').call(drag);

    function axisLinks() {
      var axis_links = d3
        .select('.axis-select')
        .selectAll('a')
        .data(options.colorspace.axis);

      axis_links.exit().remove();
      axis_links
        .enter()
        .append('button')
        .attr('class', function(d) {
          return (
            'axis-option col12 block button uppercase unround keyline-bottom ' +
            d[0]
          );
        })
        .attr('data-tooltip', function(d) {
          return d[1];
        })
        .classed('active', function(d) {
          return d[0] == options.axis;
        })
        .text(function(d) {
          return d[0][0] + '–' + d[0][1];
        })
        .on('click', function(d) {
          initPosSet = false;
          updateAxis(d[0]);
          resetGradient();
          renderColorSpace();
          showGradient();
          d3.selectAll('.axis-option').classed('active', function(_) {
            return _[0] == d[0];
          });
        });
    }

    setView(options.axis);
    axisLinks();
    showGradient();
  }
};

var mode = d3.selectAll('.js-mode');
var vizs = d3.select('#visualization');
var pick = d3.select('#picker');
var select = d3.select('.js-select');

var path = d3.geo.path().projection(
  d3.geo
    .albersUsa()
    .scale(960)
    .translate([480, 265])
);

var svg = vizs
  .append('svg:svg')
  .attr('width', 960)
  .attr('height', 500);

var counties = svg.append('svg:g').attr('id', 'counties');

function choropleth(counties, colors) {
  var pad = d3.format('05d');
  d3.json('example-data/unemployment.json', function(data) {
    var quantize = d3.scale
      .quantile()
      .domain(d3.values(data))
      .range(d3.range(colors.length));
    d3.json('example-data/us-counties.json', function(json) {
      counties
        .selectAll('path')
        .data(json.features)
        .enter()
        .append('svg:path')
        .attr('style', function(d) {
          return 'fill:' + colors[quantize(data[pad(d.id)])] + ';';
        })
        .attr('d', path)
        .append('svg:title')
        .text(function(d) {
          return d.properties.name + ': ' + data[pad(d.id)] + '%';
        });
      d3.select('#visualization').classed('loading', false);
    });
  });
}

var colorArray = [];
var clipboardEl = d3.select('#select');
clipboard = new clipboard('#select');

clipboard.on('success', function() {
  clipboardEl.text('Copied!');
  window.setTimeout(function() {
    clipboardEl
      .text('Copy')
      .append('span')
      .attr('class', 'sprite icon clipboard');
  }, 1000);
});

new Colorpicker({
  callback: function(colors) {
    colorArray = colors;
    select.attr('data-clipboard-text', colors);
  }
});

mode.on('click', function() {
  var el = d3.select(this);
  mode.classed('active', false);
  el.classed('active', true);

  if (el.attr('href').split('#')[1] === 'picker') {
    vizs.classed('hidden', true);
    pick.classed('hidden', false);
    counties.selectAll('path').remove();
  } else {
    pick.classed('hidden', true);
    vizs.classed('hidden', false).classed('loading', true);
    choropleth(counties, colorArray);
  }
});
