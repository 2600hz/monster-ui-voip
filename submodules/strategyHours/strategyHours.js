define(function(require) {
	var monster = require('monster'),
		_ = require('lodash'),
		$ = require('jquery'),
		Papa = require('papaparse'),
		timezone = require('monster-timezone');

	require('file-saver');

	var isNotUndefined = _.negate(_.isUndefined),
		/**
		 * Returns whether a pair of objects match against a property.
		 * @param  {String} prop Property to match against.
		 * @param  {Object} a The object to compare.
		 * @param  {Object} b The other object to compare.
		 * @return {Boolean}
		 */
		compareBy = function compareBy(prop, a, b) {
			var values = _.map([a, b], prop);
			return _.every([
				_.every(values, isNotUndefined),
				_.spread(_.isEqual)(values)
			]);
		};

	return {
		subscribe: {
			'voip.strategyHours.render': 'strategyHoursRender',
			'voip.strategyHours.listing.onUpdate': 'strategyHoursListingOnUpdate'
		},

		appFlags: {
			strategyHours: {
				intervals: {
					max: 86400,
					unit: 3600,
					step: 1800,
					exportFilename: 'office-hours',
					typesOrderSignificance: [
						'lunch',
						'open'
					]
				},
				apiToTemplateTypesMap: {
					main_weekdays: 'open',
					main_lunchbreak: 'lunch'
				},
				templatePresets: {
					nineToFiveWithNoonToOneLunchbreak: _
						.chain(5)
						.range()
						.map(function() {
							return [
								{ start: 3600 * 9, end: 3600 * 12, type: 'open' },
								{ start: 3600 * 12, end: 3600 * 13, type: 'lunch' },
								{ start: 3600 * 13, end: 3600 * 17, type: 'open' }
							];
						})
						.concat([[], []])
						.value()
				}
			}
		},

		strategyHoursRender: function(args) {
			var self = this,
				$container = args.container,
				strategyData = args.strategyData,
				callback = args.callback,
				intervals = self.strategyHoursExtractDaysIntervalsFromStrategyData(strategyData),
				template = $(self.getTemplate({
					name: 'layout',
					data: {
						alwaysOpen: _.every(intervals, _.isEmpty),
						companyTimezone: timezone.formatTimezone(strategyData.callflows.MainCallflow.flow.data.timezone || monster.apps.auth.currentAccount.timezone)
					},
					submodule: 'strategyHours'
				}));

			console.log(intervals);
			$container
				.find('.element-content')
					.empty()
					.append(template);

			self.strategyHoursListingRender($container, intervals);
			self.strategyHoursBindEvents($container, template, strategyData);

			callback && callback();
		},

		strategyHoursListingRender: function($container, intervals) {
			var self = this,
				days = self.weekdays,
				minIntervalStep = self.appFlags.strategyHours.intervals.step,
				templateData = {
					isEmpty: _.every(intervals, _.isEmpty),
					templates: _.keys(self.appFlags.strategyHours.templatePresets),
					days: _.map(days, function(day, index) {
						var label = monster.util.tryI18n(self.i18n.active().strategy.hours.days, day);

						return {
							id: day,
							abbreviation: label.slice(0, 3),
							label: label,
							intervals: intervals[index]
						};
					})
				},
				initTemplate = function initTemplate(data) {
					var $template = $(self.getTemplate({
						name: 'listing',
						data: data,
						submodule: 'strategyHours'
					}));

					_.forEach(data.days, function(day) {
						_.forEach(day.intervals, function(interval, index) {
							console.log(interval);
							var $startPicker = $template.find('input[class*="' + day.id + '[' + index + '].start"]'),
								$endPicker = $template.find('input[class*="' + day.id + '[' + index + '].end"]'),
								intervals = day.intervals,
								previousBound = intervals[index - 1] ? intervals[index - 1].end : 0,
								nextBound = intervals[index + 1] ? intervals[index + 1].start : 86400;

							monster.ui.timepicker($startPicker, {
								useSelect: true,
								minTime: previousBound,
								maxTime: interval.end - minIntervalStep
							});
							monster.ui.timepicker($endPicker, {
								useSelect: true,
								minTime: interval.start + minIntervalStep,
								maxTime: nextBound
							});
							$startPicker.timepicker('setTime', interval.start);
							$endPicker.timepicker('setTime', interval.end);
						});
					});

					self.strategyHoursListingBindEvents($container, $template);

					return $template;
				};

			$container
				.find('.office-hours-wrapper')
					.empty()
					.append(initTemplate(templateData));

			monster.pub('voip.strategyHours.listing.onUpdate', $container);
		},

		strategyHoursBindEvents: function(parent, template, strategyData) {
			var self = this;

			template.on('change', '.custom-hours-toggler input[type="radio"]', function(e) {
				var toggleDiv = template.find('.custom-hours-div'),
					shouldOpen = $(this).val() === 'true',
					toggleMethod = shouldOpen ? 'slideDown' : 'slideUp';

				toggleDiv[toggleMethod](200);
			});

			template.on('click', '.add-hours', function(event) {
				event.preventDefault();

				monster.pub('voip.strategy.addOfficeHours', {
					existing: self.strategyHoursGetDaysIntervalsFromTemplate(parent),
					callback: function(err, existing) {
						self.strategyHoursListingRender(parent, existing);
					}
				});
			});

			template.on('click', '.import-csv', function(event) {
				event.preventDefault();

				monster.pub('common.csvUploader.renderPopup', {
					title: self.i18n.active().strategy.hours.importOfficeHours.title,
					onSuccess: _.flow(
						_.bind(self.strategyHoursExtractDaysIntervalsFromCsvData, self),
						_.bind(self.strategyHoursNormalizeDaysIntervals, self),
						_.bind(self.strategyHoursListingRender, self, parent)
					)
				});
			});

			template.on('click', '.export-csv', function(event) {
				event.preventDefault();

				var weekdays = self.weekdays,
					meta = self.appFlags.strategyHours.intervals,
					formatIntervalsToCsv = function(intervals, index) {
						return _.map(intervals, function(interval) {
							return {
								day: weekdays[index],
								start: interval.start / meta.unit,
								end: interval.end / meta.unit,
								type: interval.type
							};
						});
					},
					getBlobFromCsv = function(csv) {
						return new Blob([csv], {
							type: 'text/csv;chartset=utf-8'
						});
					},
					saveIntervalsAsCsv = _.flow(
						_.bind(self.strategyHoursGetDaysIntervalsFromTemplate, self),
						_.partial(_.flatMap, _, formatIntervalsToCsv),
						Papa.unparse,
						getBlobFromCsv,
						_.partial(saveAs, _, meta.exportFilename + '.csv')
					);

				saveIntervalsAsCsv(parent);
			});

			template.find('form').on('submit', function(event) {
				event.preventDefault();

				var $button = $(event.originalEvent.submitter),
					$section = $(this).parents('.element-container'),
					formData = monster.ui.getFormData('strategy_custom_hours_form'),
					is24hStrategy = formData.enabled === 'true',
					weekdays = self.weekdays,
					intervals = is24hStrategy
						? self.strategyHoursGetDaysIntervalsFromTemplate(parent)
						: _.map(weekdays, function() { return []; });

				$button.prop('disabled', 'disabled');

				self.strategyHoursUpdateStrategyData(intervals, strategyData, function() {
					$section.find('.element-content').slideUp();
					$section.removeClass('open');
				});
			});
		},

		strategyHoursListingBindEvents: function(parent, template) {
			var self = this;

			template.on('click', '.office-hours-nav .nav-item:not(.active):not(.disabled)', function(event) {
				var $this = $(this),
					day = $this.data('day');

				template.find('.office-hours-nav .nav-item.active').removeClass('active');
				$this.addClass('active');

				if (day) {
					template.find('.office-hours').hide();
					template.find('.office-hours[data-day="' + day + '"]').fadeIn(200);
				} else {
					template.find('.office-hours').fadeIn(200);
				}
			});

			template.on('change', '.office-hours-content .empty-state select[name="template"]', function(event) {
				event.preventDefault();

				var option = $(this).val();

				if (!option) {
					return;
				}

				self.strategyHoursListingRender(parent, self.appFlags.strategyHours.templatePresets[option]);
			});

			template.on('change', 'input.ui-timepicker-input', function(event) {
				event.preventDefault();

				var $picker = $(this),
					seconds = $picker.timepicker('getSecondsFromMidnight'),
					$boundPicker = $picker.siblings('input'),
					isFrom = _.endsWith($picker.prop('name'), '.start'),
					method = isFrom ? 'minTime' : 'maxTime',
					newTime = isFrom ? seconds + (3600 / 2) : seconds - (3600 / 2);

				$boundPicker.timepicker('option', method, newTime);
			});

			template.on('change', 'input.ui-timepicker-input', function(event) {
				event.preventDefault();

				var $picker = $(this),
					seconds = $picker.timepicker('getSecondsFromMidnight'),
					$interval = $picker.parents('.interval'),
					isFrom = _.endsWith($picker.prop('name'), '.start'),
					$boundPicker = isFrom
						? $interval.prev().find('input[name$=".end"]')
						: $interval.next().find('input[name$=".start"]'),
					isExtremity = !$boundPicker.is(':empty'),
					method = isFrom ? 'maxTime' : 'minTime';

				$boundPicker.timepicker('option', method, seconds);

				if (isExtremity) {
					$picker.timepicker('option', isFrom ? 'minTime' : 'maxTime', isFrom ? 0 : 3600 * 24);
				}
			});

			template.on('click', '.office-hours .delete-interval', function() {
				var $this = $(this),
					$interval = $this.parents('.interval'),
					$intervals = $interval.parents('.intervals'),
					$dayContainer = $interval.parents('.office-hours'),
					$navItems = template.find('.office-hours-nav .nav-item'),
					day = $dayContainer.data('day'),
					$prevPicker = $interval.prev().find('input[name$=".end"]'),
					$nextPicker = $interval.next().find('input[name$=".start"]');

				$interval.slideUp(200, function() {
					$interval.remove();

					monster.pub('voip.strategyHours.listing.onUpdate', parent);

					$prevPicker.trigger('change');
					$nextPicker.trigger('change');

					if ($intervals.is(':empty')) {
						$dayContainer.slideUp(200, function() {
							$dayContainer.remove();

							$navItems
								.filter('[data-day="' + day + '"]')
									.removeClass('active')
									.addClass('disabled');

							$navItems.filter(':not([data-day])').click();

							if (template.find('.office-hours-content .office-hours').length === 0) {
								template.find('.office-hours-content .empty-state').slideDown(200);
							}
						});
					}
				});
			});
		},

		strategyHoursListingOnUpdate: function(parent) {
			var self = this,
				intervalsByDays = self.strategyHoursGetDaysIntervalsFromTemplate(parent),
				isEmpty = _.every(intervalsByDays, _.isEmpty),
				method = isEmpty ? 'fadeOut' : 'fadeIn';

			parent.find('.export-csv')[method](200);
		},

		/**
		 * Returns an array of arrays containing nonoverlapping intervals.
		 * @param  {Array[]} intervalsByDays
		 * @return {Array[]}
		 */
		strategyHoursNormalizeDaysIntervals: function(intervalsByDays) {
			var self = this,
				meta = _.pick(self.appFlags.strategyHours.intervals, [
					'step',
					'typesOrderSignificance'
				]),
				breakUp = function(step, interval) {
					return _
						.chain(interval.start)
						.range(interval.end, step)
						.map(function(start) {
							return _.merge({}, interval, {
								start: start,
								end: start + step
							});
						})
						.value();
				},
				identify = _.flow(
					_.partial(_.pick, _, ['start', 'end']),
					_.values,
					_.sortBy,
					_.join
				),
				resolve = function(typesOrder, intervals) {
					return _
						.chain(typesOrder)
						.map(function(type) {
							return _.find(intervals, { type: type });
						})
						.find(isNotUndefined)
						.value();
				},
				combine = function(step, intervals) {
					var pointer = 0;

					while (pointer < intervals.length - 1) {
						var current = intervals[pointer],
							nextIndex = _.findIndex(intervals, function(interval, index) {
								var isNonLinear = intervals[index - 1].end + step < interval.start,
									isDifferentType = !_.isEqual(interval.type, current.type);

								return isNonLinear || isDifferentType;
							}, pointer + 1),
							lastOfTypeIndex = nextIndex > -1 ? nextIndex - 1 : intervals.length - 1,
							lastOfType = intervals[lastOfTypeIndex];

						if (pointer !== lastOfTypeIndex) {
							current.end = lastOfType.end;
							intervals.splice(pointer + 1, lastOfTypeIndex - pointer);
						}

						pointer += 1;
					}

					return intervals;
				};

			return _.map(intervalsByDays, _.flow(
				_.partial(_.flatMap, _, _.partial(breakUp, meta.step)),
				_.partial(_.uniqWith, _, _.isEqual),
				_.partial(_.groupBy, _, identify),
				_.partial(_.map, _, _.partial(resolve, meta.typesOrderSignificance)),
				_.partial(_.sortBy, _, 'start'),
				_.partial(_.thru, _, _.partial(combine, meta.step)),
			));
		},

		/**
		 * Returns an array of arrays containing intervals for each day of the week.
		 * @param  {Array} csvData
		 * @return {Array[]}
		 *
		 * Intervals are extracted from CSV data and are not necessarily linear and/or concurrent.
		 */
		strategyHoursExtractDaysIntervalsFromCsvData: function(csvData) {
			var self = this,
				weekdays = self.weekdays,
				meta = self.appFlags.strategyHours.intervals,
				validTypes = _.map(self.appFlags.strategyHours.apiToTemplateTypesMap),
				expectedHeader = ['day', 'start', 'end', 'type'],
				potentialHeader = _
					.chain(csvData)
					.head()
					.map(_.toLower)
					.value(),
				hasHeader = _.isEqual(
					_.sortBy(potentialHeader),
					_.sortBy(expectedHeader)
				),
				header = hasHeader ? potentialHeader : expectedHeader,
				entries = hasHeader ? _.tail(csvData) : csvData,
				extractObjects = function(entry) {
					return _.reduce(header, function(acc, prop, index) {
						return _.merge(
							_.set({}, prop, entry[index]),
							acc
						);
					}, {});
				},
				sanitizeString = _.flow(
					_.toString,
					_.toLower
				),
				parseTime = function(time) {
					return time <= 24 ? time * meta.unit : time;
				},
				sanitizeTime = _.flow(
					_.toNumber,
					parseTime,
					_.floor
				),
				sanitize = function(entry) {
					return {
						day: sanitizeString(entry.day),
						start: sanitizeTime(entry.start),
						end: sanitizeTime(entry.end),
						type: sanitizeString(entry.type)
					};
				},
				isTimeValid = function(time, lower, upper) {
					return _.every([
						_.inRange(time, lower, upper),
						time % meta.step === 0
					]);
				},
				isValid = function(entry) {
					var start = entry.start,
						end = entry.end,
						isDayValid = _.includes(self.weekdays, entry.day),
						isTypeValid = _.includes(validTypes, entry.type),
						areTimesValid = _.every([
							isTimeValid(start, 0, end),
							isTimeValid(end, start + 1, meta.max + 1)
						]);

					return _.every([
						isDayValid,
						isTypeValid,
						areTimesValid
					]);
				},
				intervalsPerDays = _
					.chain(entries)
					.map(extractObjects)
					.map(sanitize)
					.filter(isValid)
					.groupBy('day')
					.value();

			return _.map(weekdays, function(day, index) {
				return _
					.chain(intervalsPerDays)
					.get(day, [])
					.map(_.partial(_.omit, _, 'day'))
					.sortBy('start')
					.value();
			});
		},

		/**
		 * Returns an array of arrays containing intervals for each day of the week.
		 * @param  {Object} strategyData.temporalRules
		 * @return {Array[]}
		 *
		 * Intervals are extracted from temporal rules and are not necessarily nonoverlapping or
		 * linear (start/end where the previous/next one begins/ends).
		 */
		strategyHoursExtractDaysIntervalsFromStrategyData: function(strategyData) {
			var self = this,
				weekdays = self.weekdays,
				types = self.appFlags.strategyHours.apiToTemplateTypesMap,
				activeRuleIds = _
					.chain(strategyData.callflows.MainCallflow)
					.get('flow.children', {})
					.omit('_')
					.keys()
					.value(),
				isRuleActive = _.flow(
					_.partial(_.get, _, 'id'),
					_.partial(_.includes, activeRuleIds)
				),
				extractIntervalsForRule = function(types, rule) {
					var type = _.get(types, rule.type);

					return _.map(rule.wdays, function(day) {
						return {
							start: rule.time_window_start,
							end: rule.time_window_stop,
							type: type,
							day: day
						};
					});
				},
				intervalsPerDays = _
					.chain(strategyData.temporalRules)
					.pick(['weekdays', 'lunchbreak'])
					.flatMap(_.values)
					.filter(isRuleActive)
					.flatMap(_.partial(extractIntervalsForRule, types))
					.groupBy('day')
					.value();

			return _.map(weekdays, function(day) {
				return _
					.chain(intervalsPerDays)
					.get(day, [])
					.map(_.partial(_.omit, _, 'day'))
					.sortBy('start')
					.value();
			});
		},

		/**
		 * Returns an array of arrays containing intervals for each day of the week.
		 * @param  {jQuery} parent
		 * @return {Array[]}
		 *
		 * Intervals are extracted from the DOM and are nonoverlapping and linear.
		 */
		strategyHoursGetDaysIntervalsFromTemplate: function(parent) {
			var self = this,
				days = self.weekdays;

			return _.map(days, function(day) {
				var $el = parent.find('.office-hours[data-day="' + day + '"]');

				return _.map($el.find('.interval'), function(interval) {
					var $interval = $(interval);

					return {
						start: $interval.find('input[name$=".start"]').timepicker('getSecondsFromMidnight'),
						end: $interval.find('input[name$=".end"]').timepicker('getSecondsFromMidnight'),
						type: $interval.find('select.status').val()
					};
				});
			});
		},

		/**
		 * Builds and runs tasks to create/update/delete temporal rules based on intervals.
		 * @param  {Array[]}   intervalsByDays
		 * @param  {Object[]}   existingRules
		 * @param  {String}   onCreateMetadata.type
		 * @param  {String}   onCreateMetadata.name
		 * @param  {Function} callback
		 */
		strategyHoursReconcileTemporalRules: function(intervalsByDays, existingRules, onCreateMetadata, callback) {
			var self = this,
				weekdays = self.weekdays,
				injectProp = function(prop, value, object) {
					return _.merge({}, object, _.set({}, prop, value));
				},
				getIdentifierFromTimes = _.flow(
					_.partial(_.pick, _, ['start', 'end']),
					_.values,
					_.partial(_.sortBy),
					_.partial(_.join, _, ',')
				),
				buildInterval = function(intervals, identifier) {
					var times = _.chain(identifier).split(',').map(Number).value();
					return {
						start: _.head(times),
						end: _.last(times),
						days: _.map(intervals, 'day')
					};
				},
				reduceIntervalsByDays = function reduceIntervalsByDays(intervalsByDays) {
					return _
						.chain(intervalsByDays)
						.flatMap(function(intervals, index) {
							var weekday = weekdays[index];
							return _.map(intervals, _.partial(injectProp, 'day', weekday));
						})
						.groupBy(getIdentifierFromTimes)
						.map(buildInterval)
						.value();
				},
				getUnusedRules = function(rules, usedIds) {
					return _.reject(rules, _.flow(
						_.partial(_.get, _, 'id'),
						_.partial(_.includes, usedIds)
					));
				},
				mapIds = _.partial(_.map, _, 'id'),
				findRuleMatchingTimes = function(rules, start, end) {
					return _.find(rules, {
						time_window_start: start,
						time_window_stop: end
					});
				},
				findRuleMatchingDays = function(rules, days) {
					return _.find(rules, _.flow(
						_.partial(_.get, _, 'wdays'),
						_.sortBy,
						_.partial(_.isEqual, _, _.sortBy(days))
					));
				},
				compareById = _.partial(compareBy, 'id'),
				groupRulesPerTask = function groupRulesPerTask(intervalsByTimes, rules) {
					var toReuse = [],
						toUpdate = [],
						toCreate = [];

					_.forEach(intervalsByTimes, function(interval) {
						var unsuedRules = getUnusedRules(rules, mapIds(_.concat(toReuse, toUpdate))),
							matchingTimes = findRuleMatchingTimes(unsuedRules, interval.start, interval.end),
							/**
							 * We force the potential times match to be checked first as we could
							 * have another rule matching the same days but not the times.
							 */
							matchingDays = findRuleMatchingDays(unsuedRules.sort(function(rule) {
								return compareById(rule, matchingTimes) ? -1 : 1;
							}), interval.days),
							matchingRules = [matchingTimes, matchingDays];

						if (compareById(matchingTimes, matchingDays)) {
							toReuse.push(matchingTimes);
						} else if (_.some(matchingRules, isNotUndefined)) {
							toUpdate.push(_.merge({
								id: _.find(matchingRules, _.flow(
									_.partial(_.ary(_.get, 2), _, 'id'),
									isNotUndefined
								)).id
							}, interval));
						} else {
							toCreate.push(interval);
						}
					});

					return {
						toReuse: toReuse,
						toUpdate: toUpdate,
						toCreate: toCreate,
						toDelete: getUnusedRules(rules, mapIds(_.concat(toReuse, toUpdate)))
					};
				},
				getTasksToRun = function getTasksToRun(rulesPerTask) {
					var toReuse = _.map(rulesPerTask.toReuse, function(rule) {
							return function(next) {
								next(null, rule);
							};
						}),
						toUpdate = _.map(rulesPerTask.toUpdate, function(rule) {
							return function(next) {
								self.callApi({
									resource: 'temporalRule.patch',
									data: {
										accountId: self.accountId,
										ruleId: rule.id,
										data: {
											time_window_start: rule.start,
											time_window_stop: rule.end,
											wdays: rule.days
										}
									},
									success: _.flow(
										_.partial(_.get, _, 'data'),
										_.partial(next, null)
									),
									error: _.partial(next, null)
								});
							};
						}),
						toCreate = _.map(rulesPerTask.toCreate, function(rule) {
							return function(next) {
								self.callApi({
									resource: 'temporalRule.create',
									data: {
										accountId: self.accountId,
										data: _.merge({
											cycle: 'weekly',
											interval: 1,
											time_window_start: rule.start,
											time_window_stop: rule.end,
											wdays: rule.days
										}, onCreateMetadata)
									},
									success: _.flow(
										_.partial(_.get, _, 'data'),
										_.partial(next, null)
									),
									error: _.partial(next, null)
								});
							};
						}),
						toDelete = _.map(rulesPerTask.toDelete, function(rule) {
							return function(next) {
								self.callApi({
									resource: 'temporalRule.delete',
									data: {
										accountId: self.accountId,
										ruleId: rule.id
									},
									success: _.flow(
										_.partial(_.get, _, 'data'),
										_.partial(next, null)
									),
									error: _.partial(next, null)
								});
							};
						});

					return {
						toAdd: function(next) {
							monster.parallel(_.flatten([
								toReuse,
								toUpdate,
								toCreate
							]), next);
						},
						toRemove: function(next) {
							monster.parallel(toDelete, next);
						}
					};
				};

			monster.parallel(_.flow(
				reduceIntervalsByDays,
				_.partial(groupRulesPerTask, _, existingRules),
				getTasksToRun
			)(intervalsByDays), callback);
		},

		/**
		 * Update/create temporal rules to match days' intervals and update main callflow if needed.
		 * @param  {Array[]}   intervals
		 * @param  {Object}   strategyData
		 * @param  {Function} callback
		 */
		strategyHoursUpdateStrategyData: function(intervalsByDays, strategyData, callback) {
			var self = this,
				normalizedIntervals = self.strategyHoursNormalizeDaysIntervals(intervalsByDays),
				openHoursIntervals = _.map(normalizedIntervals, _.partial(_.filter, _, { type: 'open' })),
				openHoursRules = _.get(strategyData.temporalRules, 'weekdays', {}),
				reconcileOpenHoursRules = _.bind(self.strategyHoursReconcileTemporalRules, self, openHoursIntervals, openHoursRules, {
					type: 'main_weekdays',
					name: 'MainOpenHours'
				}),
				lunchHoursIntervals = _.map(normalizedIntervals, _.partial(_.filter, _, { type: 'lunch' })),
				lunchHoursRules = _.get(strategyData.temporalRules, 'lunchbreak', {}),
				reconcileLunchHoursRules = _.bind(self.strategyHoursReconcileTemporalRules, self, lunchHoursIntervals, lunchHoursRules, {
					type: 'main_lunchbreak',
					name: 'MainLunchHours'
				}),
				reconcileTemporalRules = _.partial(monster.parallel, {
					weekdays: reconcileOpenHoursRules,
					lunchbreak: reconcileLunchHoursRules
				}),
				rebuildTemporalRulesInPlace = function(actionsByType, strategyData) {
					var openRules = _.get(actionsByType, 'weekdays', {}),
						lunchRules = _.get(actionsByType, 'lunchbreak', {}),
						mainOpenHoursCallflowId = strategyData.callflows.MainOpenHours.id,
						mainLunchHoursCallflowId = strategyData.callflows.MainLunchHours.id;

					_.forEach(openRules.toAdd, function(rule) {
						_.set(strategyData.temporalRules, ['weekdays', rule.id], rule);
						strategyData.callflows.MainCallflow.flow.children[rule.id] = {
							children: {},
							data: {
								id: mainOpenHoursCallflowId
							},
							module: 'callflow'
						};
					});
					_.forEach(openRules.toRemove, function(rule) {
						_.unset(strategyData.temporalRules, ['weekdays', rule.id]);
						_.unset(strategyData.callflows.MainCallflow.flow.children, rule.id);
					});

					_.forEach(lunchRules.toAdd, function(rule) {
						_.set(strategyData.temporalRules, ['lunchbreak', rule.id], rule);
						strategyData.callflows.MainCallflow.flow.children[rule.id] = {
							children: {},
							data: {
								id: mainLunchHoursCallflowId
							},
							module: 'callflow'
						};
					});
					_.forEach(lunchRules.toRemove, function(rule) {
						_.unset(strategyData.temporalRules, ['lunchbreak', rule.id]);
						_.unset(strategyData.callflows.MainCallflow.flow.children, rule.id);
					});
				},
				updateMainCallflowCatchAllInPlace = function(strategyData) {
					var rulesIds = _
							.chain(strategyData.temporalRules)
							.pick(['weekdays', 'lunchbreak'])
							.flatMap(_.values)
							.map('id')
							.value(),
						activeRulesIds = _
							.chain(strategyData.callflows.MainCallflow.flow.children)
							.omit('_')
							.keys()
							.value(),
						hasActiveRules = _.some(rulesIds, _.partial(_.includes, activeRulesIds)),
						catchAllCallflowId = _.get(
							strategyData.callflows,
							[hasActiveRules ? 'MainAfterHours' : 'MainOpenHours', 'id']
						);

					strategyData.callflows.MainCallflow.flow.children._ = {
						children: {},
						data: {
							id: catchAllCallflowId
						},
						module: 'callflow'
					};
				},
				rebuildMainCallflowRulesInPlace = _.bind(self.strategyRebuildMainCallflowRuleArray, self),
				shouldUpdateMainCallflow = function(current, strategyData) {
					var currentRules = _.sortBy(current.rules),
						updatedRules = _.sortBy(strategyData.callflows.MainCallflow.flow.data.rules),
						currentCatchAll = current.catchAllCallflowId,
						updatedCatchAll = strategyData.callflows.MainCallflow.flow.children._.data.id;

					return !_.every([
						_.isEqual(currentRules, updatedRules),
						currentCatchAll === updatedCatchAll
					]);
				},
				updateStrategyDataInPlace = function updateStrategyDataInPlace(actionsPerType, strategyData) {
					var current = {
						rules: _.get(strategyData.callflows.MainCallflow, 'flow.data.rules', []),
						catchAllCallflowId: _.get(strategyData.callflows.MainCallflow, 'flow.children._.data.id')
					};

					rebuildTemporalRulesInPlace(actionsPerType, strategyData);
					updateMainCallflowCatchAllInPlace(strategyData);
					rebuildMainCallflowRulesInPlace(strategyData);

					monster.waterfall([
						function(next) {
							if (!shouldUpdateMainCallflow(current, strategyData)) {
								return next(null);
							}
							self.strategyUpdateCallflow(strategyData.callflows.MainCallflow, function(updatedCallflow) {
								strategyData.callflows.MainCallflow = updatedCallflow;
								next(null);
							});
						}
					], callback);
				};

			monster.waterfall([
				reconcileTemporalRules,
				_.partial(updateStrategyDataInPlace, _, strategyData)
			], callback);
		}
	};
});
