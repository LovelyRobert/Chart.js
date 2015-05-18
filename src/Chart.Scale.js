(function() {
	"use strict";
	
	 var root = this,
        Chart = root.Chart,
        helpers = Chart.helpers;
	
	// The scale service is used to resize charts along with all of their axes. We make this as
	// a service where scales are registered with their respective charts so that changing the 
	// scales does not require 
	Chart.scaleService = {
		registeredCharts: [],
		getWrapperForChart: function(chartInstance) {
			var wrapper = helpers.findNextWhere(this.registeredCharts, function(charScaleWrapper) {
				return charScaleWrapper.chartInstance == chartInstance;
			});
			
			return wrapper;
		},
		registerChartScale: function(chartInstance, scaleInstance) {
			var chartScaleWrapper = this.getWrapperForChart(chartInstance);
			
			if (!chartScaleWrapper) {
				chartScaleWrapper = {
					scales: [],
					chartInstance: chartInstance,
				};
				
				this.registeredCharts.push(chartScaleWrapper);
			}
			
			chartScaleWrapper.scales.push(scaleInstance);
		},
		removeChartScale: function(chartInstance, scaleInstance) {
			var chartScaleWrapper = this.getWrapperForChart(chartInstance);
			
			if (chartScaleWrapper) {
				var scaleIndex = helpers.indexOf(scaleWrapper.scales, scaleInstance);
				
				if (scaleIndex) {
					scaleWrapper.scales.splice(scaleIndex, 1);
				}
			}
		},
		// Remove a chart instance from the scale service. Useful when a chart is destroyed
		removeChartInstance: function(chartInstance) {
			var index = helpers.findNextWhere(this.registeredCharts, function(scaleWrapper) {
				return scaleWrapper.chartInstance == chartInstance;
			});
			
			if (index) {
				this.registeredCharts.splice(index, 1);
			}
		},
		// The interesting function
		fitScalesForChart: function(chartInstance, width, height) {
			var chartScaleWrapper = this.getWrapperForChart(chartInstance);
			var xPadding = 10;
			var yPadding = 10;
			
			if (chartScaleWrapper) {
				var leftScales = helpers.where(chartScaleWrapper.scales, function(scaleInstance) {
					return scaleInstance.options.position == "left";
				});
				var rightScales = helpers.where(chartScaleWrapper.scales, function(scaleInstance) {
					return scaleInstance.options.position == "right";
				});
				var topScales = helpers.where(chartScaleWrapper.scales, function(scaleInstance) {
					return scaleInstance.options.position == "top";
				});
				var bottomScales = helpers.where(chartScaleWrapper.scales, function(scaleInstance) {
					return scaleInstance.options.position == "bottom";
				});
				
				// Adjust the padding to take into account displaying labels
				if (topScales.length === 0 || bottomScales.length === 0) {
					var maxFontHeight = 0;
					
					var maxFontHeightFunction = function(scaleInstance) {
						if (scaleInstance.options.labels.show) {
							// Only consider font sizes for axes that actually show labels
							maxFontHeight = Math.max(maxFontHeight, scaleInstance.options.labels.fontSize);
						}
					};
					
					helpers.each(leftScales, maxFontHeightFunction);
					helpers.each(rightScales, maxFontHeightFunction);
					
					if (topScales.length === 0) {
						// Add padding so that we can handle drawing the top nicely
						yPadding += 0.75 * maxFontHeight; // 0.75 since padding added on both sides
					}
					
					if (bottomScales.length === 0) {
						// Add padding so that we can handle drawing the bottom nicely
						yPadding += 1.5 * maxFontHeight;
					}
				}
				
				// Essentially we now have any number of scales on each of the 4 sides.
				// Our canvas looks like the following.
				// The areas L1 and L2 are the left axes. R1 is the right axis, T1 is the top axis and 
				// B1 is the bottom axis
				// |------------------------------------------------------|
				// |		  |				T1						|	  |
				// |----|-----|-------------------------------------|-----|
				// |	|     |									    |     |
				// | L1	|  L2 |			Chart area					|  R1 |
				// |	|	  |										|     |
				// |	|	  |										|     |
				// |----|-----|-------------------------------------|-----|
				// |		  |				B1						|	  |
				// |		  |										|	  |
				// |------------------------------------------------------|
				
				// What we do to find the best sizing, we do the following
				// 1. Determine the minimum size of the chart area. 
				// 2. Split the remaining width equally between each vertical axis
				// 3. Split the remaining height equally between each horizontal axis
				// 4. Give each scale the maximum size it can be. The scale will return it's minimum size
				// 5. Adjust the sizes of each axis based on it's minimum reported size. 
				// 6. Refit each axis
				// 7. Position each axis in the final location
				// 8. Tell the chart the final location of the chart area
				
				// Step 1
				var chartWidth = width / 2; // min 50%
				var chartHeight = height / 2; // min 50%
				var aspectRatio = chartHeight / chartWidth;
				var screenAspectRatio;
				
				if (chartInstance.options.maintainAspectRatio) {
					screenAspectRatio = height / width;
					
					if (aspectRatio != screenAspectRatio) {
						chartHeight = chartWidth * screenAspectRatio;
						aspectRatio = screenAspectRatio;
					}
				}
				
				chartWidth -= (2 * xPadding);
				chartHeight-= (2 * yPadding);
				
				// Step 2
				var verticalScaleWidth = (width - chartWidth) / (leftScales.length + rightScales.length);
				
				// Step 3
				var horizontalScaleHeight = (height - chartHeight) / (topScales.length + bottomScales.length);
				
				// Step 4;
				var scalesToMinSize = {};
				
				var verticalScaleMinSizeFunction = function(scaleInstance) {
					var minSize = scaleInstance.fit(verticalScaleWidth, chartHeight);
					scalesToMinSize[scaleInstance] = minSize;
				};
				
				var horizontalScaleMinSizeFunction = function(scaleInstance) {
					var minSize = scaleInstance.fit(chartWidth, horizontalScaleHeight);
					scalesToMinSize[scaleInstance] = minSize;
				};
				
				// vertical scales
				helpers.each(leftScales, verticalScaleMinSizeFunction);
				helpers.each(rightScales, verticalScaleMinSizeFunction);
				
				// horizontal scales
				helpers.each(topScales, horizontalScaleMinSizeFunction);
				helpers.each(bottomScales, horizontalScaleMinSizeFunction);
				
				// Step 5
				var maxChartHeight = height - (2 * yPadding);
				var maxChartWidth = width - (2 * xPadding);
				
				var chartWidthReduceFunction = function(scaleInstance) {
					maxChartWidth -= scalesToMinSize[scaleInstance].width;
				};
				
				var chartHeightReduceFunction = function(scaleInstance) {
					maxChartHeight -= scalesToMinSize[scaleInstance].height;
				};
				
				helpers.each(leftScales, chartWidthReduceFunction);
				helpers.each(rightScales, chartWidthReduceFunction);
				helpers.each(topScales, chartHeightReduceFunction);
				helpers.each(bottomScales, chartHeightReduceFunction);
				
				// At this point, maxChartHeight and maxChartWidth are the size the chart area could
				// be if the axes are drawn at their minimum sizes.
				if (chartInstance.options.maintainAspectRatio) {
					// Figure out what the real max size will be
					var maxAspectRatio = maxChartHeight / maxChartWidth;
					
					if (maxAspectRatio != screenAspectRatio) {
						// Need to adjust
						if (maxChartHeight < maxChartWidth) {
							maxChartWidth = maxChartHeight / screenAspectRatio;
						}
						else {
							maxChartHeight = maxChartWidth * screenAspectRatio;
						}
					}
				}
				
				// Step 6
				var verticalScaleFitFunction = function(scaleInstance) {
					var minSize = scalesToMinSize[scaleInstance];
					scaleInstance.fit(minSize.width, maxChartHeight);
				};
				
				var horizontalScaleFitFunction = function(scaleInstance) {
					var minSize = scalesToMinSize[scaleInstance];
					scaleInstance.fit(maxChartWidth, minSize.width);
				};
				
				helpers.each(leftScales, verticalScaleFitFunction);
				helpers.each(rightScales, verticalScaleFitFunction);
				helpers.each(topScales, horizontalScaleFitFunction);
				helpers.each(bottomScales, horizontalScaleFitFunction);
				
				// Step 7 
				var totalLeftWidth = xPadding;
				var totalTopHeight = yPadding;
				
				// Calculate total width of all left axes
				helpers.each(leftScales, function(scaleInstance) {
					totalLeftWidth += scaleInstance.width;
				});
				
				// Calculate total height of all top axes
				helpers.each(topScales, function(scaleInstance) {
					totalTopHeight += scaleInstance.height;
				});
				
				// Position the scales
				var left = xPadding;
				var top = yPadding;
				var right = 0;
				var bottom = 0;
				
				var verticalScalePlacer = function(scaleInstance) {
					scaleInstance.left = left;
					scaleInstance.right = left + scaleInstance.width;
					scaleInstance.top = totalTopHeight;
					scaleInstance.bottom = totalTopHeight + maxChartHeight;
					
					// Move to next point
					left = scaleInstance.right;
				};
				
				var horizontalScalePlacer = function(scaleInstance) {
					scaleInstance.left = totalLeftWidth;
					scaleInstance.right = totalLeftWidth + maxChartWidth;
					scaleInstance.top = top;
					scaleInstance.bottom = top + scaleInstance.height;
					
					// Move to next point 
					top = scaleInstance.bottom;
				};
				
				helpers.each(leftScales, verticalScalePlacer);
				helpers.each(topScales, horizontalScalePlacer);
				
				// Account for chart width and height
				left += maxChartWidth;
				top  += maxChartHeight;
				
				helpers.each(rightScales, verticalScalePlacer);
				helpers.each(bottomScales, horizontalScalePlacer);
				
				// Step 8
				chartScaleWrapper.chartInstance.chartArea = {
					left: totalLeftWidth,
					top: totalTopHeight,
					right: totalLeftWidth + maxChartWidth,
					bottom: totalTopHeight + maxChartHeight,
				};
			}
		}
	};
	
	// Scale registration object. Extensions can register new scale types (such as log or DB scales) and then
	// use the new chart options to grab the correct scale
	Chart.scales = {
		constructors: {}, 
		// Use a registration function so that we can move to an ES6 map when we no longer need to support
		// old browsers
		registerScaleType: function(scaleType, scaleConstructor) {
			this.constructors[scaleType] = scaleConstructor;
		},
		getScaleConstructor: function(scaleType) {
			return this.constructors.hasOwnProperty(scaleType) ? this.constructors[scaleType] : undefined;
		}
	};
	
	var LinearScale = Chart.Element.extend({
		calculateRange: helpers.noop, // overridden in the chart. Will set min and max as properties of the scale for later use
		isHorizontal: function() {
			return this.options.position == "top" || this.options.position == "bottom";
		},
		generateTicks: function(width, height) {
			// We need to decide how many ticks we are going to have. Each tick draws a grid line.
			// There are two possibilities. The first is that the user has manually overridden the scale
			// calculations in which case the job is easy. The other case is that we have to do it ourselves
			// 
			// We assume at this point that the scale object has been updated with the following values
			// by the chart.
			// 	min: this is the minimum value of the scale
			//	max: this is the maximum value of the scale
			//	options: contains the options for the scale. This is referenced from the user settings
			//		rather than being cloned. This ensures that updates always propogate to a redraw
			
			// Reset the ticks array. Later on, we will draw a grid line at these positions
			// The array simply contains the numerical value of the spots where ticks will be
			this.ticks = [];
			
			if (this.options.override) {
				// The user has specified the manual override. We use <= instead of < so that 
				// we get the final line
				for (var i = 0; i <= this.options.override.steps; ++i) {
					var value = this.options.override.start + (i * this.options.override.stepWidth);
					ticks.push(value);
				}
			}
			else {
				// Figure out what the max number of ticks we can support it is based on the size of
				// the axis area. For now, we say that the minimum tick spacing in pixels must be 50
				// We also limit the maximum number of ticks to 11 which gives a nice 10 squares on 
				// the graph
				
				var maxTicks;
				
				if (this.isHorizontal()) {
					maxTicks = Math.min(11, Math.ceil(width / 50));
				} else {
					// The factor of 2 used to scale the font size has been experimentally determined.
					maxTicks = Math.min(11, Math.ceil(height / (2 * this.options.labels.fontSize)));
				}
				
				// Make sure we always have at least 2 ticks 
				maxTicks = Math.max(2, maxTicks);
				
				// To get a "nice" value for the tick spacing, we will use the appropriately named 
				// "nice number" algorithm. See http://stackoverflow.com/questions/8506881/nice-label-algorithm-for-charts-with-minimum-ticks
				// for details.
				
				// If we are forcing it to begin at 0, but 0 will already be rendered on the chart,
				// do nothing since that would make the chart weird. If the user really wants a weird chart
				// axis, they can manually override it
				if (this.options.beginAtZero) {
					var minSign = helpers.sign(this.min);
					var maxSign = helpers.sign(this.max);
					
					if (minSign < 0 && maxSign < 0) {
						// move the top up to 0
						this.max = 0;
					} else if (minSign > 0 && maxSign > 0) {
						// move the botttom down to 0
						this.min = 0;
					}
				}
				
				var niceRange = helpers.niceNum(this.max - this.min, false);
				var spacing = helpers.niceNum(niceRange / (maxTicks - 1), true);
				var niceMin = Math.floor(this.min / spacing) * spacing;
				var niceMax = Math.ceil(this.max / spacing) * spacing;
				
				// Put the values into the ticks array
				for (var j = niceMin; j <= niceMax; j += spacing) {
					this.ticks.push(j);
				}
			}
			
			if (this.options.position == "left" || this.options.position == "right") {
				// We are in a vertical orientation. The top value is the highest. So reverse the array
				this.ticks.reverse();
			}
			
			// At this point, we need to update our max and min given the tick values since we have expanded the
			// range of the scale
			this.max = helpers.max(this.ticks);
			this.min = helpers.min(this.ticks);
		},
		buildLabels: function() {
			// We assume that this has been run after ticks have been generated. We try to figure out
			// a label for each tick. 
			this.labels = [];
			
			helpers.each(this.ticks, function(tick, index, ticks) {
				var label; 
				
				if (this.options.labelCallback) {
					// If the user provided a callback for label generation, use that as first priority
					label = this.options.labelCallback(tick, index, ticks);
				} else if (this.options.labels.template) {
					// else fall back to the template string
					label = helpers.template(this.options.labels.template, {
						value: tick
					});
				}
				
				this.labels.push(label ? label : ""); // empty string will not render so we're good
			}, this);
		},
		getPixelForValue: function(value) {
			// This must be called after fit has been run so that 
			//		this.left, this.top, this.right, and this.bottom have been defined
			var pixel;
			var range = this.max - this.min;
			
			if (this.isHorizontal()) {
				pixel = this.left + (this.width / range * (value - this.min));
			} else {
				// Bottom - top since pixels increase downard on a screen
				pixel = this.bottom - (this.height / range * (value - this.min));
			}
			
			return pixel;
		},
		// Fit this axis to the given size
		// @param {number} maxWidth : the max width the axis can be
		// @param {number} maxHeight: the max height the axis can be
		// @return {object} minSize : the minimum size needed to draw the axis
		fit: function(maxWidth, maxHeight) {
			this.calculateRange();
			this.generateTicks(maxWidth, maxHeight);
			this.buildLabels();
			
			var minSize = {
				width: 0,
				height: 0,
			};
			
			if (this.isHorizontal()) {
				minSize.width = maxWidth; // fill all the width
				
				// In a horizontal axis, we need some room for the scale to be drawn
				//
				//		-----------------------------------------------------
				//			|			|			|			|			|
				//
				minSize.height = this.options.gridLines.show ? 25 : 0;
			} else {
				minSize.height = maxHeight; // fill all the height
				
				// In a vertical axis, we need some room for the scale to be drawn.
				// The actual grid lines will be drawn on the chart area, however, we need to show 
				// ticks where the axis actually is.
				// We will allocate 25px for this width
				//		|
				//	   -|
				//	    |
				//		|
				//	   -|
				//	    |
				//		|
				//	   -|
				minSize.width = this.options.gridLines.show ? 25 : 0;
			}
			
			if (this.options.labels.show) {
				// Don't bother fitting the labels if we are not showing them
				var labelFont = helpers.fontString(this.options.labels.fontSize, 
					this.options.labels.fontStyle, this.options.labels.fontFamily);
				
				if (this.isHorizontal()) {
					// A horizontal axis is more constrained by the height.
					var maxLabelHeight = maxHeight - minSize.height;
					var labelHeight = 1.5 * this.options.labels.fontSize;
					minSize.height = Math.min(maxHeight, minSize.height + labelHeight);
				} else {
					// A vertical axis is more constrained by the width. Labels are the dominant factor 
					// here, so get that length first
					var maxLabelWidth = maxWidth - minSize.width;
					var largestTextWidth = helpers.longestText(this.ctx, labelFont, this.labels);
					
					if (largestTextWidth < maxLabelWidth) {
						// We don't need all the room
						minSize.width += largestTextWidth;
					} else {
						// Expand to max size
						minSize.width = maxWidth;
					}
				}
			}
			
			this.width = minSize.width;
			this.height = minSize.height;
			return minSize;
		},
		// Actualy draw the scale on the canvas
		// @param {rectangle} chartArea : the area of the chart to draw full grid lines on
		draw: function(chartArea) {
			if (this.options.show) {
				
				var setContextLineSettings;
				var hasZero;
				
				// Make sure we draw text in the correct color
				this.ctx.fillStyle = this.options.labels.fontColor;
				
				if (this.isHorizontal()) {
					if (this.options.gridLines.show) {
						// Draw the horizontal line
						setContextLineSettings = true;
						hasZero = helpers.findNextWhere(this.ticks, function(tick) { return tick === 0; }) !== undefined;
						var yTickStart = this.options.position == "bottom" ? this.top : this.bottom - 10;
						var yTickEnd = this.options.position == "bottom" ? this.top + 10 : this.bottom;

						helpers.each(this.ticks, function(tick, index) {
							// Grid lines are vertical
							var xValue = this.getPixelForValue(tick);
							
							if (tick === 0 || (!hasZero && index === 0)) {
								// Draw the 0 point specially or the left if there is no 0
								this.ctx.lineWidth = this.options.gridLines.zeroLineWidth;
								this.ctx.strokeStyle = this.options.gridLines.zeroLineColor;
								setContextLineSettings = true; // reset next time
							} else if (setContextLineSettings) {
								this.ctx.lineWidth = this.options.gridLines.lineWidth;
								this.ctx.strokeStyle = this.options.gridLines.color;
								setContextLineSettings = false;
							}
							
							xValue += helpers.aliasPixel(this.ctx.lineWidth);
							
							// Draw the label area
							this.ctx.beginPath();
							this.ctx.moveTo(xValue, yTickStart);
							this.ctx.lineTo(xValue, yTickEnd);
							
							// Draw the chart area
							if (this.options.gridLines.drawOnChartArea) {
								this.ctx.moveTo(xValue, chartArea.top);
								this.ctx.lineTo(xValue, chartArea.bottom);
							}

							// Need to stroke in the loop because we are potentially changing line widths & colours
							this.ctx.stroke();
						}, this);
					}

					if (this.options.labels.show) {
						// Draw the labels
						
						var labelStartY;
						
						if (this.options.position == "top") {
							labelStartY = this.top;
						} else {
							// bottom side
							labelStartY = this.top + 20;
						}
						
						this.ctx.textAlign = "center";
						this.ctx.textBaseline = "top";
						this.ctx.font = helpers.fontString(this.options.labels.fontSize, this.options.labels.fontStyle, this.options.labels.fontFamily);
						
						helpers.each(this.labels, function(label, index) {
							var xValue = this.getPixelForValue(this.ticks[index]);
							this.ctx.fillText(label, xValue, labelStartY);
						}, this);
					}
				} else {
					// Vertical
					if (this.options.gridLines.show) {
						
						// Draw the vertical line
						setContextLineSettings = true;
						hasZero = helpers.findNextWhere(this.ticks, function(tick) { return tick === 0; }) !== undefined;
						var xTickStart = this.options.position == "right" ? this.left : this.right - 10;
						var xTickEnd = this.options.position == "right" ? this.left + 10 : this.right;
						
						helpers.each(this.ticks, function(tick, index) {
							// Grid lines are horizontal
							var yValue = this.getPixelForValue(tick);
							
							if (tick === 0 || (!hasZero && index === 0)) {
								// Draw the 0 point specially or the bottom if there is no 0
								this.ctx.lineWidth = this.options.gridLines.zeroLineWidth;
								this.ctx.strokeStyle = this.options.gridLines.zeroLineColor;
								setContextLineSettings = true; // reset next time
							} else if (setContextLineSettings) {
								this.ctx.lineWidth = this.options.gridLines.lineWidth;
								this.ctx.strokeStyle = this.options.gridLines.color;
								setContextLineSettings = false; // use boolean to indicate that we only want to do this once
							}
							
							yValue += helpers.aliasPixel(this.ctx.lineWidth);

							// Draw the label area
							this.ctx.beginPath();
							this.ctx.moveTo(xTickStart, yValue);
							this.ctx.lineTo(xTickEnd, yValue);
							
							// Draw the chart area
							if (this.options.gridLines.drawOnChartArea) {
								this.ctx.moveTo(chartArea.left, yValue);
								this.ctx.lineTo(chartArea.right, yValue);
							}

							this.ctx.stroke();
						}, this);
					}
					
					if (this.options.labels.show) {
						// Draw the labels
						
						var labelStartX;
						var maxLabelWidth = this.width - 25;
						
						if (this.options.position == "left") {
							labelStartX = this.left;
						} else {
							// right side
							labelStartX = this.left + 20;
						}
						
						this.ctx.textAlign = "left";
						this.ctx.textBaseline = "middle";
						this.ctx.font = helpers.fontString(this.options.labels.fontSize, this.options.labels.fontStyle, this.options.labels.fontFamily);
						
						helpers.each(this.labels, function(label, index) {
							var yValue = this.getPixelForValue(this.ticks[index]);
							this.ctx.fillText(label, labelStartX, yValue, maxLabelWidth);
						}, this);
					}
				}
			}
		}
	});
	Chart.scales.registerScaleType("linear", LinearScale);
}).call(this);