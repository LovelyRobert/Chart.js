(function() {
	"use strict";

	var root = this,
		Chart = root.Chart,
		helpers = Chart.helpers;

	Chart.defaults.global.legend = {

		display: true,
		position: 'top',
		fullWidth: true, // marks that this box should take the full width of the canvas (pushing down other boxes)
		onClick: false, // a callback will override the default behavior of toggling the datasets

		labels: {
			boxWidth: 40,
			fontSize: 12,
			fontStyle: "normal",
			fontColor: "#666",
			fontFamily: "Helvetica Neue",
			padding: 10,
			callback: function(dataset) {
				return '' + dataset.label;
			},

			// Generates labels shown in the legend
			generateLabels: function(data) {
				return data.datasets.map(function(dataset) {
					return this.options.labels.callback.call(this, dataset);
				}, this);
			}
		},
	};

	Chart.Legend = Chart.Element.extend({

		initialize: function(config) {
			helpers.extend(this, config);

			// Contains hit boxes for each dataset (in dataset order)
			this.legendHitBoxes = [];

			// Are we in doughnut mode which has a different data type
			this.doughnutMode = false;
		},

		// These methods are ordered by lifecyle. Utilities then follow.
		// Any function defined here is inherited by all legend types.
		// Any function can be extended by the legend type

		beforeUpdate: helpers.noop,
		update: function(maxWidth, maxHeight, margins) {

			// Update Lifecycle - Probably don't want to ever extend or overwrite this function ;)
			this.beforeUpdate();

			// Absorb the master measurements
			this.maxWidth = maxWidth;
			this.maxHeight = maxHeight;
			this.margins = margins;

			// Dimensions
			this.beforeSetDimensions();
			this.setDimensions();
			this.afterSetDimensions();
			// Labels
			this.beforeBuildLabels();
			this.buildLabels();
			this.afterBuildLabels();

			// Fit
			this.beforeFit();
			this.fit();
			this.afterFit();
			//
			this.afterUpdate();

			return this.minSize;

		},
		afterUpdate: helpers.noop,

		//

		beforeSetDimensions: helpers.noop,
		setDimensions: function() {
			// Set the unconstrained dimension before label rotation
			if (this.isHorizontal()) {
				// Reset position before calculating rotation
				this.width = this.maxWidth;
				this.left = 0;
				this.right = this.width;
			} else {
				this.height = this.maxHeight;

				// Reset position before calculating rotation
				this.top = 0;
				this.bottom = this.height;
			}

			// Reset padding
			this.paddingLeft = 0;
			this.paddingTop = 0;
			this.paddingRight = 0;
			this.paddingBottom = 0;

			// Reset minSize
			this.minSize = {
				width: 0,
				height: 0,
			};
		},
		afterSetDimensions: helpers.noop,

		//

		beforeBuildLabels: helpers.noop,
		buildLabels: function() {
			this.labels = this.options.labels.generateLabels.call(this, this.chart.data);
		},
		afterBuildLabels: helpers.noop,

		//

		beforeFit: helpers.noop,
		fit: function() {

			var ctx = this.ctx;
			var labelFont = helpers.fontString(this.options.labels.fontSize, this.options.labels.fontStyle, this.options.labels.fontFamily);

			// Reset hit boxes
			this.legendHitBoxes = [];

			// Width
			if (this.isHorizontal()) {
				this.minSize.width = this.maxWidth; // fill all the width
			} else {
				this.minSize.width = this.options.display ? 10 : 0;
			}

			// height
			if (this.isHorizontal()) {
				this.minSize.height = this.options.display ? 10 : 0;
			} else {
				this.minSize.height = this.maxHeight; // fill all the height
			}

			// Increase sizes here
			if (this.isHorizontal()) {
				// Labels

				// Width of each line of legend boxes. Labels wrap onto multiple lines when there are too many to fit on one
				this.lineWidths = [0];
				var totalHeight = this.labels.length ? this.options.labels.fontSize + (this.options.labels.padding) : 0;

				ctx.textAlign = "left";
				ctx.textBaseline = 'top';
				ctx.font = labelFont;

				helpers.each(this.labels, function(label, i) {
					var width = this.options.labels.boxWidth + (this.options.labels.fontSize / 2) + ctx.measureText(label).width;
					if (this.lineWidths[this.lineWidths.length - 1] + width >= this.width) {
						totalHeight += this.options.labels.fontSize + (this.options.labels.padding);
						this.lineWidths[this.lineWidths.length] = this.left;
					}

					// Store the hitbox width and height here. Final position will be updated in `draw`
					this.legendHitBoxes[i] = {
						left: 0,
						top: 0,
						width: width,
						height: this.options.labels.fontSize,
					};

					this.lineWidths[this.lineWidths.length - 1] += width + this.options.labels.padding;
				}, this);

				this.minSize.height += totalHeight;

			} else {
				// TODO vertical
			}

			this.width = this.minSize.width;
			this.height = this.minSize.height;

		},
		afterFit: helpers.noop,

		// Shared Methods
		isHorizontal: function() {
			return this.options.position == "top" || this.options.position == "bottom";
		},

		// Actualy draw the legend on the canvas
		draw: function() {
			if (this.options.display) {
				var ctx = this.ctx;
				var cursor = {
					x: this.left + ((this.width - this.lineWidths[0]) / 2),
					y: this.top + this.options.labels.padding,
					line: 0,
				};

				var labelFont = helpers.fontString(this.options.labels.fontSize, this.options.labels.fontStyle, this.options.labels.fontFamily);

				// Horizontal
				if (this.isHorizontal()) {
					// Labels
					ctx.textAlign = "left";
					ctx.textBaseline = 'top';
					ctx.lineWidth = 0.5;
					ctx.strokeStyle = this.options.labels.fontColor; // for strikethrough effect
					ctx.fillStyle = this.options.labels.fontColor; // render in correct colour
					ctx.font = labelFont;

					helpers.each(this.labels, function(label, i) {
						var dataset = this.chart.data.datasets[i];
						var backgroundColor = dataset.backgroundColor;
						var borderColor = dataset.borderColor;

						var textWidth = ctx.measureText(label).width;
						var width = this.options.labels.boxWidth + (this.options.labels.fontSize / 2) + textWidth;
						
						if (cursor.x + width >= this.width) {
							cursor.y += this.options.labels.fontSize + (this.options.labels.padding);
							cursor.line++;
							cursor.x = this.left + ((this.width - this.lineWidths[cursor.line]) / 2);
						}

						// Set the ctx for the box
						ctx.save();
						
						ctx.strokeStyle = dataset.borderColor || Chart.defaults.global.defaultColor;
						ctx.fillStyle = dataset.backgroundColor || Chart.defaults.global.defaultColor;
						
						if (dataset.metaDataset) {
							// Is this a line-like element? If so, stroke the box
							if (ctx.setLineDash) {
								// IE 9 and 10 do not support line dash
								ctx.setLineDash(dataset.borderDash || Chart.defaults.global.elements.line.borderDash);
							}

							ctx.lineCap = dataset.borderCapStyle || Chart.defaults.global.elements.line.borderCapStyle;
							ctx.lineDashOffset = dataset.borderDashOffset || Chart.defaults.global.elements.line.borderDashOffset;
							ctx.lineJoin = dataset.borderJoinStyle || Chart.defaults.global.elements.line.borderJoinStyle;
							ctx.lineWidth = dataset.borderWidth || Chart.defaults.global.elements.line.borderWidth;
						}
						
						// Draw the box
						ctx.strokeRect(cursor.x, cursor.y, this.options.labels.boxWidth, this.options.labels.fontSize);
						ctx.fillRect(cursor.x, cursor.y, this.options.labels.boxWidth, this.options.labels.fontSize);
						
						ctx.restore();

						this.legendHitBoxes[i].left = cursor.x;
						this.legendHitBoxes[i].top = cursor.y;

						// Fill the actual label
						ctx.fillText(label, this.options.labels.boxWidth + (this.options.labels.fontSize / 2) + cursor.x, cursor.y);

						if (dataset.hidden) {
							// Strikethrough the text if hidden
							ctx.beginPath();
							ctx.lineWidth = 2;
							ctx.moveTo(this.options.labels.boxWidth + (this.options.labels.fontSize / 2) + cursor.x, cursor.y + (this.options.labels.fontSize / 2));
							ctx.lineTo(this.options.labels.boxWidth + (this.options.labels.fontSize / 2) + cursor.x + textWidth, cursor.y + (this.options.labels.fontSize / 2));
							ctx.stroke();
						}

						cursor.x += width + (this.options.labels.padding);
					}, this);
				} else {

				}
			}
		},

		// Handle an event
		handleEvent: function(e) {
			var position = helpers.getRelativePosition(e, this.chart.chart);

			if (position.x >= this.left && position.x <= this.right && position.y >= this.top && position.y <= this.bottom) {
				// Legend is active
				if (this.options.onClick) {
					this.options.onClick.call(this, e);
				} else {
					// See if we are touching one of the dataset boxes
					for (var i = 0; i < this.legendHitBoxes.length; ++i) {
						var hitBox = this.legendHitBoxes[i];

						if (position.x >= hitBox.left && position.x <= hitBox.left + hitBox.width && position.y >= hitBox.top && position.y <= hitBox.top + hitBox.height) {
							this.chart.data.datasets[i].hidden = !this.chart.data.datasets[i].hidden;

							// We hid a dataset ... rerender the chart
							this.chart.update();
							break;
						}
					}
				}
			}
		}
	});

}).call(this);
