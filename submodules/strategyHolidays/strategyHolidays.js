define(function(require) {
	var monster = require('monster'),
		_ = require('lodash'),
		$ = require('jquery'),
		footable = require('footable');

	return {
		subscribe: {
			'voip.strategyHolidays.render': 'strategyHolidaysRender'
		},

		appFlags: {
			strategyHolidays: {
				allHolidays: [],
				deletedHolidays: [],
				months: [
					'Jan',
					'Feb',
					'Mar',
					'Apr',
					'May',
					'Jun',
					'Jul',
					'Aug',
					'Sep',
					'Oct',
					'Nov',
					'Dec'
				],
				wdays: [
					'sunday',
					'monday',
					'tuesday',
					'wednesday',
					'thursday',
					'friday',
					'saturday'
				]
			}
		},

		strategyHolidaysRender: function(args) {
			var self = this,
				$container = args.container,
				strategyData = args.strategyData,
				holidaysData = self.strategyHolidaysExtractHolidaysFromStrategyData(strategyData),
				callback = args.callback,
				getListOfYears = function getListOfYears() {
					var date = new Date(),
						year = parseInt(date.getFullYear()),
						totalYears = 3,
						yearsArray = [];

					while (totalYears >= 0) {
						yearsArray.push(year);
						year++;
						totalYears--;
					}

					return yearsArray;
				},
				template = $(self.getTemplate({
					name: 'layout',
					data: {
						enabled: !_.isEmpty(strategyData.temporalRules.holidays),
						years: getListOfYears()
					},
					submodule: 'strategyHolidays'
				}));

			$container
				.find('.element-content')
					.empty()
					.append(template);

			monster.ui.footable(template.find('.footable'), {
				filtering: {
					placeholder: self.i18n.active().strategy.holidays.listing.search
				},
				paging: {
					enabled: false
				},
				on: {
					'postdraw.ft.table': function(event, ft) {
						var dataArray = ft.rows.array;

						if (_.size(dataArray) < 1) {
							template
								.find('.custom-footable-empty')
									.addClass('show');
						} else {
							template
								.find('.custom-footable-empty')
									.removeClass('show');
						}
					}
				}
			});

			self.strategyHolidaysListingRender($container, holidaysData);
			self.strategyHolidaysBindEvents($container, template, holidaysData, strategyData);

			callback && callback();
		},

		strategyHolidaysListingRender: function($container, holidaysData) {
			var self = this,
				table = footable.get('#holidays_list_table'),
				yearSelected = parseInt($container.find('#year').val()),
				holidaysDataArray = [],
				initTemplate = function initTemplate(data) {
					var dateToDisplay = function dateToDisplay($container, data) {
							var getNumberWithOrdinal = function getNumberWithOrdinal(date) {
									var ordinal = ['th', 'st', 'nd', 'rd'],
										v = date % 100;
									return date + (ordinal[(v - 20) % 10] || ordinal[v] || ordinal[0]);
								},
								holidayData = data.holidayData,
								months = self.appFlags.strategyHolidays.months,
								fromMonth = months[holidayData.fromMonth - 1],
								fromDay = getNumberWithOrdinal(holidayData.fromDay),
								wdays = self.appFlags.strategyHolidays.wdays,
								date = new Date(yearSelected, holidayData.fromMonth - 1, holidayData.fromDay),
								dateToText = '';

							switch (data.holidayType) {
								case 'advanced':
									var selectedDay = self.strategyHolidaysGetOrdinalWday(holidayData, yearSelected),
										day = _.upperCase(holidayData.wday.charAt(0)) + holidayData.wday.substr(1, 2);

									dateToText = day + ' ' + fromMonth + ' ' + getNumberWithOrdinal(selectedDay);
									break;

								case 'single':
									var fullDay = wdays[date.getDay()],
										day = _.upperCase(fullDay.charAt(0)) + fullDay.substr(1, 2);

									dateToText = day + ' ' + fromMonth + ' ' + fromDay;
									break;

								case 'range':
									var startFullDay = wdays[date.getDay()],
										startDay = _.upperCase(startFullDay.charAt(0)) + startFullDay.substr(1, 2),
										endDate = new Date(yearSelected, holidayData.toMonth - 1, holidayData.toDay),
										endFullDay = wdays[endDate.getDay()],
										endDay = _.upperCase(endFullDay.charAt(0)) + endFullDay.substr(1, 2),
										toMonth = months[holidayData.toMonth - 1],
										toDay = getNumberWithOrdinal(holidayData.toDay);

									dateToText = startDay + ' ' + fromMonth + ' ' + fromDay + ' - ' + endDay + ' ' + toMonth + ' ' + toDay;
									break;
							}

							return dateToText;
						},
						template = $(self.getTemplate({
							name: 'listing',
							data: {
								holidayType: data.holidayType,
								holidayData: data.holidayData,
								dateToDisplay: dateToDisplay($container, data)
							},
							submodule: 'strategyHolidays'
						}));

					self.strategyHolidaysListingBindEvents($container, template);

					return template;
				};

			_.each(holidaysData, function(value, key) {
				var endYear = _.get(value, 'holidayData.endYear', yearSelected),
					excludeYear = _.get(value, 'holidayData.excludeYear', []);

				if (endYear === yearSelected && !_.includes(excludeYear, yearSelected)) {
					holidaysDataArray.push(initTemplate(value));
				}
			});

			table.rows.load(holidaysDataArray, true);
		},

		strategyHolidaysDeleteDialogRender: function(parent, data) {
			var self = this,
				template = $(self.getTemplate({
					name: 'deleteHolidayDialog',
					data: {
						holidayName: data.holidayName
					},
					submodule: 'strategyHolidays'
				})),
				optionsPopup = {
					position: ['center', 20],
					title: '<i class="fa fa-warning monster-red"></i><div class="title">' + self.i18n.active().strategy.holidays.dialogs.delete.title + '</div>',
					dialogClass: 'monster-alert holiday-delete-dialog'
				},
				popup = monster.ui.dialog(template, optionsPopup);

			self.strategyHolidaysDeleteDialogBindsEvents(template, parent, popup, data.holidayId);
		},

		strategyHolidaysBindEvents: function(parent, template, holidaysData, strategyData) {
			var self = this;

			parent.on('change', '.holidays-toggler input[type="checkbox"]', function() {
				var $this = $(this);

				if ($this.prop('checked')) {
					parent
						.find('.holidays-div')
						.slideDown();
				} else {
					parent
						.find('.holidays-div')
						.slideUp();
				}
			});

			parent.on('change', '#year', function() {
				var table = footable.get('#holidays_list_table'),
					allHolidays = self.appFlags.strategyHolidays.allHolidays;

				/*empty table before loading the rows for the year selected*/
				table.rows.load([]);
				self.strategyHolidaysListingRender(parent, allHolidays);
			});

			template.on('click', '.add-holiday', function(event) {
				event.preventDefault();

				monster.pub('voip.strategy.addEditOfficeHolidays', {
					yearSelected: parseInt(parent.find('#year').val()),
					existingHolidays: _.map(self.appFlags.strategyHolidays.allHolidays, function(holiday) {
						return {
							id: _.get(holiday, 'holidayData.id'),
							name: _.get(holiday, 'holidayData.name')
						};
					}),
					callback: function(err, data) {
						self.appFlags.strategyHolidays.allHolidays.push(data);
						self.strategyHolidaysListingRender(parent, [data]);
					}
				});
			});

			template.on('click', '.save-button', function(event) {
				event.preventDefault();

				var $button = $(event.originalEvent.submitter),
					$section = $(this).parents('.element-container'),
					isEnabled = parent.find('.holidays-toggler input[type="checkbox"]')[0].checked,
					allHolidays = self.appFlags.strategyHolidays.allHolidays,
					updateStrategyData = function updateStrategyData(strategyData) {
						self.strategyHolidaysUpdateStrategyData(strategyData, function() {
							$section.find('.element-content').slideUp();
							$section.removeClass('open');
						});
					};

				$button.prop('disabled', 'disabled');

				if (!isEnabled) {
					monster.ui.confirm(self.i18n.active().strategy.confirmMessages.disableHolidays, function() {
						_.forEach(allHolidays, function(holiday, key) {
							var holidayId = _.get(holiday, 'holidayData.id');

							if (!_.includes(holidayId, 'new-')) {
								self.appFlags.strategyHolidays.deletedHolidays.push(holidayId);
							}
						});
						self.appFlags.strategyHolidays.allHolidays = {};
						updateStrategyData(strategyData);
					});
				} else {
					updateStrategyData(strategyData);
				}
			});
		},

		strategyHolidaysListingBindEvents: function(parent, template) {
			var self = this;

			template.on('click', '.delete-holiday', function(event) {
				event.preventDefault();

				var $this = $(this),
					holidayName = $this.parents('tr').find('td:first-child').html(),
					id = $this.parents('tr').data('id'),
					data = {
						holidayName: holidayName,
						holidayId: id
					};

				self.strategyHolidaysDeleteDialogRender(parent, data);
			});

			template.on('click', '.edit-holiday', function(event) {
				event.preventDefault();

				var $this = $(this),
					id = $this.parents('tr').data('id'),
					table = footable.get('#holidays_list_table'),
					yearSelected = parseInt(parent.find('#year').val()),
					allHolidays = self.appFlags.strategyHolidays.allHolidays,
					holidayRuleId = _.findKey(allHolidays, function(holiday) {
						return _.get(holiday, 'holidayData.id') === id;
					}),
					holidayRule = allHolidays[holidayRuleId];

				monster.pub('voip.strategy.addEditOfficeHolidays', {
					yearSelected: parseInt(parent.find('#year').val()),
					existingHolidays: _.map(allHolidays, function(holiday) {
						return {
							id: _.get(holiday, 'holidayData.id'),
							name: _.get(holiday, 'holidayData.name')
						};
					}),
					holidayRule: holidayRule,
					callback: function(err, data) {
						/*Compare old date with new data if it's recurring*/
						var isOldRecurring = _.get(holidayRule, 'holidayData.recurring', false);

						if (isOldRecurring) {
							/* update existing rule */
							if (_.isUndefined(holidayRule.holidayData.excludeYear)) {
								holidayRule.holidayData.excludeYear = [];
							}
							holidayRule.holidayData.excludeYear.push(yearSelected);
							holidayRule.modified = true;
							self.appFlags.strategyHolidays.allHolidays[holidayRuleId] = holidayRule;

							/* add new rule */
							self.appFlags.strategyHolidays.allHolidays.push(data);
						} else {
							self.appFlags.strategyHolidays.allHolidays[holidayRuleId] = data;
						}

						/*empty table before re-loading all rows*/
						table.rows.load([]);
						self.strategyHolidaysListingRender(parent, allHolidays);
					}
				});
			});
		},

		strategyHolidaysDeleteDialogBindsEvents: function(template, parent, popup, holidayId) {
			var self = this;

			template.find('.cancel').on('click', function(event) {
				popup.dialog('close').remove();
			});

			template.find('.delete').on('click', function(event) {
				event.preventDefault();

				var table = footable.get('#holidays_list_table'),
					yearSelected = parseInt(parent.find('#year').val()),
					isChecked = template.find('.deleteAll').prop('checked'),
					allHolidays = self.appFlags.strategyHolidays.allHolidays,
					holidayRuleId = _.findKey(allHolidays, function(holiday) {
						return _.get(holiday, 'holidayData.id') === holidayId;
					}),
					holidayRule = allHolidays[holidayRuleId],
					isRecurring = _.get(holidayRule, 'holidayData.recurring', false);

				if ((isRecurring && isChecked) || !isRecurring) {
					if (!_.includes(holidayId, 'new-')) {
						self.appFlags.strategyHolidays.deletedHolidays.push(holidayId);
					}
					delete allHolidays.splice(holidayRuleId, 1);
				} else {
					if (_.isUndefined(holidayRule.holidayData.excludeYear)) {
						holidayRule.holidayData.excludeYear = [];
					}
					holidayRule.modified = true;
					holidayRule.holidayData.excludeYear.push(yearSelected);

					self.appFlags.strategyHolidays.allHolidays[holidayRuleId] = holidayRule;
				}

				/*empty table before re-loading all rows*/
				table.rows.load([]);
				self.strategyHolidaysListingRender(parent, allHolidays);

				popup.dialog('close').remove();
			});
		},

		/**
		 * Returns an array of objects all holidays.
		 * @param  {Object} strategyData.temporalRules
		 * @return {Array[]}
		 * Holidays are extracted from temporal rules
		 */
		strategyHolidaysExtractHolidaysFromStrategyData: function(strategyData) {
			var self = this,
				holidaysData = [];

			_.each(_.get(strategyData.temporalRules, 'holidays', {}), function(val, key) {
				var endDate = val.hasOwnProperty('viewData')
					? _.get(val, 'viewData.end_date')
					: _.get(val, 'end_date');

				if (val.id in strategyData.callflows.MainCallflow.flow.children) {
					var holidayType,
						holidayData = {
							id: val.id,
							name: val.name,
							fromMonth: val.month,
							recurring: true
						};

					if (val.hasOwnProperty('ordinal')) {
						holidayType = 'advanced';
						holidayData.ordinal = val.ordinal;
						holidayData.wday = val.wdays[0];
					} else {
						if (val.hasOwnProperty('viewData')) {
							holidayType = 'range';
							holidayData.fromDay = val.viewData.fromDay;
							holidayData.fromMonth = val.viewData.fromMonth;
							holidayData.toDay = val.viewData.toDay;
							holidayData.toMonth = val.viewData.toMonth;
							holidayData.set = true;
						} else {
							holidayData.fromDay = val.days[0];

							if (val.days.length > 1) {
								holidayType = 'range';
								holidayData.toDay = val.days[val.days.length - 1];
								holidayData.toMonth = val.month;
							} else {
								holidayType = 'single';
							}
						}
					}

					if (endDate) {
						holidayData.endYear = monster.util.gregorianToDate(endDate).getFullYear();
						holidayData.recurring = false;
					}
					holidaysData.push({ holidayType: holidayType, holidayData: holidayData });

					if (val.hasOwnProperty('exclude')) {
						holidayData.excludeYear = [];

						_.forEach(val.exclude, function(date) {
							var year = parseInt(date.substring(0, 4));
							holidayData.excludeYear.push(year);
						});
					}
				}
				self.appFlags.strategyHolidays.allHolidays = holidaysData;
			});

			return holidaysData;
		},

		/**
		 * Returns day of month based on oridnal and wday selection.
		 * @param  {Object} holidayData
		 * @param  {Integet} yearSelected
		 * @return {Integer}
		 */
		strategyHolidaysGetOrdinalWday: function(holidayData, yearSelected) {
			var self = this,
				date = new Date(yearSelected, holidayData.fromMonth - 1),
				selectedMonth = date.getMonth(),
				ordinals = self.ordinals,
				wdays = self.appFlags.strategyHolidays.wdays,
				wdayId = _.indexOf(wdays, holidayData.wday),
				ordinalId = _.indexOf(ordinals, holidayData.ordinal),
				datesArray = [];

			//find first selected wday of the month
			date.setDate(wdayId);

			while (date.getDay() !== wdayId) {
				date.setDate(date.getDate() + 1);
			}

			//find all selected days of the month
			while (date.getMonth() === selectedMonth) {
				datesArray.push(date.getDate());
				date.setDate(date.getDate() + 7);
			}

			return ordinalId === 5 ? _.last(datesArray) : datesArray[ordinalId];
		},

		/**
		 * Returns Date
		 * @param  {string} endYear
		 * @param  {Object} holiday
		 * @return {Date}
		 */
		strategyHolidaysGetEndDate: function(endYear, holiday) {
			var self = this,
				holidayData = holiday.holidayData,
				advancedEndYear = holidayData.endYear ? holidayData.endYear : endYear;

			switch (holiday.holidayType) {
				case 'advanced':
					return new Date(endYear, holidayData.fromMonth - 1, self.strategyHolidaysGetOrdinalWday(holidayData, advancedEndYear));
				case 'range':
					return new Date(endYear, holidayData.toMonth - 1, holidayData.toDay);
				case 'single':
					return new Date(endYear, holidayData.fromMonth - 1, holidayData.fromDay);
			}
		},

		/**
		 * Returns an objects with formatted data for a holiday.
		 * @param  {Object} holiday
		 * @param  {Object} rules
		 * @return {Object[]}
		 */
		strategyHolidaysBuildHolidayRule: function(holiday) {
			var self = this,
				holidayData = _.get(holiday, 'holidayData', {}),
				name = holidayData.name,
				month = holidayData.fromMonth,
				toMonth = holidayData.toMonth,
				fromDay = holidayData.fromDay,
				toDay = holidayData.toDay,
				id = _.includes(holidayData.id, 'new-') ? null : holidayData.id,
				endDate = holidayData.recurring
					? null
					: monster.util.dateToEndOfGregorianDay(self.strategyHolidaysGetEndDate(holidayData.endYear, holiday)),
				holidayRule = {};

			if (toMonth && month !== toMonth) {
				holidayRule = {
					isRange: true,
					name: name,
					fromDay: fromDay,
					fromMonth: month,
					toDay: toDay,
					toMonth: toMonth
				};
			} else {
				holidayRule = {
					name: name,
					cycle: 'yearly',
					interval: 1,
					month: month,
					type: 'main_holidays'
				};

				if (fromDay) {
					holidayRule.days = [fromDay];
					if (toDay) {
						holidayRule.days = _.range(fromDay, toDay + 1);
					}
				} else {
					holidayRule.ordinal = holidayData.ordinal;
					holidayRule.wdays = [holidayData.wday];
				}
			}

			if (holidayData.excludeYear) {
				holidayRule.exclude = [];

				_.forEach(holidayData.excludeYear, function(year) {
					var excludeDate = self.strategyHolidaysGetEndDate(year, holiday).toISOString().split('T')[0].split('-').join('');
					holidayRule.exclude.push(excludeDate);
				});
			}

			if (id) {
				holidayRule.id = id;
			}

			if (id || endDate) {
				holidayRule.end_date = endDate;
			}

			holidayRule.extra = {
				oldType: holidayData.set ? 'set' : 'rule'
			};

			return holidayRule;
		},

		/**
		 * Returns an objects with formatted data for a holiday with type is 'range' for over a month.
		 * @param  {Object} data
		 * @param  {Function} callback
		 * @return {Object[]}
		 */
		strategyHolidaysBuildMultiMonthRangeHoliday: function(data, globalCallback) {
			var self = this,
				fromDay = parseInt(data.fromDay),
				fromMonth = parseInt(data.fromMonth),
				toDay = parseInt(data.toDay),
				toMonth = parseInt(data.toMonth),
				name = data.name,
				getMonthRule = function(name, pMonth, pStartDay, pEndDay) {
					var month = parseInt(pMonth),
						fromDay = pStartDay || 1,
						toDay = pEndDay || 31,
						days = _.range(fromDay, toDay + 1);

					return {
						name: name + '_' + month,
						cycle: 'yearly',
						days: days,
						interval: 1,
						month: month
					};
				},
				rulesToCreate = [],
				ruleSet = {
					name: name,
					temporal_rules: [],
					type: 'main_holidays'
				},
				parallelRequests = {},
				junkName = name + '_' + monster.util.randomString(6);

			if (fromMonth !== toMonth) {
				rulesToCreate.push(getMonthRule(junkName, fromMonth, fromDay, 31));

				var firstMonthLoop = fromMonth === 12 ? 1 : fromMonth + 1;

				for (var loopMonth = firstMonthLoop; (loopMonth !== toMonth && (loopMonth - 12) !== toMonth); loopMonth++) {
					if (loopMonth === 13) { loopMonth = 1; }
					rulesToCreate.push(getMonthRule(junkName, loopMonth, 1, 31));
				}

				rulesToCreate.push(getMonthRule(junkName, toMonth, 1, toDay));
			} else {
				rulesToCreate.push(getMonthRule(junkName, fromMonth, fromDay, toDay));
			}

			_.each(rulesToCreate, function(rule) {
				parallelRequests[rule.name] = function(callback) {
					self.strategyHolidaysUpdateHoliday(rule, function(data) {
						callback && callback(null, data);
					});
				};
			});

			var createCleanSet = function() {
				// Create All Rules, and then Create Rule Set.
				monster.parallel(parallelRequests, function(err, results) {
					_.each(rulesToCreate, function(rule) {
						ruleSet.temporal_rules.push(results[rule.name].id);
					});

					self.strategyHolidaysCreateRuleSet(ruleSet, function(mainData) {
						mainData.oldData = data;
						globalCallback(mainData);
					});
				});
			};

			if (data.hasOwnProperty('id')) {
				if (data.extra.oldType === 'rule') {
					self.strategyHolidaysDeleteHoliday(data.id, function() {
						createCleanSet();
					});
				} else {
					self.strategyHolidaysDeleteRuleSetAndRules(data.id, function() {
						createCleanSet();
					});
				}
			} else {
				createCleanSet();
			}
		},

		/**
		 * Builds and runs tasks to create/update/delete temporal rules based on intervals.
		 * @param  {Function} callback
		 */
		strategyHolidaysReconcileTemporalRules: function(strategyData, callback) {
			var self = this,
				holidaysToDelete = self.appFlags.strategyHolidays.deletedHolidays,
				allHolidays = self.appFlags.strategyHolidays.allHolidays,
				temporalRulesHolidays = _.get(strategyData.temporalRules, 'holidays', {}),
				groupRulesPerTask = function groupRulesPerTask(allHolidays, rules) {
					var toUpdate = [],
						toCreate = [],
						toCreateUpdateRange = [];

					_.forEach(allHolidays, function(holiday) {
						if (holiday.hasOwnProperty('modified')) {
							var holidayRule = self.strategyHolidaysBuildHolidayRule(holiday);

							if (holidayRule.hasOwnProperty('isRange')) {
								toCreateUpdateRange.push(holidayRule);
								return;
							}

							if (holidayRule.id) {
								toUpdate.push(holidayRule);
							} else {
								toCreate.push(holidayRule);
							}
						}
					});

					return {
						toUpdate: toUpdate,
						toCreate: toCreate,
						toCreateUpdateRange: toCreateUpdateRange
					};
				},
				getTasksToRun = function getTasksToRun(rulesPerTask) {
					var toCreate = _.map(rulesPerTask.toCreate, function(rule) {
							return function(next) {
								self.strategyHolidaysCreateHoliday(rule, function(data) {
									next(null, data);
								});
							};
						}),
						toUpdate = _.map(rulesPerTask.toUpdate, function(rule) {
							return function(next) {
								self.callApi({
									resource: 'temporalRule.patch',
									data: {
										accountId: self.accountId,
										ruleId: rule.id,
										data: rule
									},
									success: _.flow(
										_.partial(_.get, _, 'data'),
										_.partial(next, null)
									),
									error: _.partial(next, null)
								});
							};
						}),
						toCreateUpdateRange = _.map(rulesPerTask.toCreateUpdateRange, function(rule) {
							return function(next) {
								self.strategyHolidaysBuildMultiMonthRangeHoliday(rule, function(data) {
									data.viewData = rule;
									next(null, data);
								});
							};
						}),
						toDelete = _.map(holidaysToDelete, function(id) {
							var getRule = _.find(temporalRulesHolidays, { id: id });

							if (!_.isUndefined(getRule)) {
								return function(next) {
									if (getRule.hasOwnProperty('temporal_rules')) {
										self.strategyHolidaysDeleteRuleSetAndRules(id, function(data) {
											next(null, data);
										});
									} else {
										self.strategyHolidaysDeleteHoliday(id, function(data) {
											next(null, data);
										});
									}
								};
							}
						});

					return {
						toAdd: function(next) {
							monster.parallel(_.flatten([
								toUpdate,
								toCreate,
								toCreateUpdateRange
							]), next);
						},
						toRemove: function(next) {
							monster.parallel(toDelete, next);
						}
					};
				};

			monster.parallel(_.flow(
				_.partial(groupRulesPerTask, _, allHolidays),
				getTasksToRun
			)(allHolidays), callback);
		},

		/**
		 * Update/create temporal rules for holidays and update main callflow if needed.
		 * @param  {Boolean}   isEnabled
		 * @param  {Object}   strategyData
		 * @param  {Function} callback
		 */
		strategyHolidaysUpdateStrategyData: function(strategyData, callback) {
			var self = this,
				reconcileTemporalRules = _.bind(self.strategyHolidaysReconcileTemporalRules, self, strategyData),
				rebuildTemporalRulesInPlace = function(actionsByType, strategyData) {
					var mainCallflowId = strategyData.callflows.MainCallflow.id;

					_.forEach(actionsByType.toAdd, function(rule) {
						_.set(strategyData.temporalRules, ['holidays', rule.hasOwnProperty('temporal_rules') ? rule.name : rule.id], rule);
						strategyData.callflows.MainCallflow.flow.children[rule.id] = {
							children: {},
							data: {
								id: mainCallflowId
							},
							module: 'callflow'
						};

						if (rule.hasOwnProperty('oldData')) {
							actionsByType.toRemove.push(rule.oldData);
						}
					});

					_.forEach(actionsByType.toRemove, function(rule) {
						_.unset(strategyData.temporalRules, ['holidays', rule.hasOwnProperty('temporal_rules') ? rule.name : rule.id]);
						_.unset(strategyData.callflows.MainCallflow.flow.children, rule.id);
					});
				},
				updateMainCallflowCatchAllInPlace = function(strategyData) {
					var holidayCallflowId = _.get(strategyData.callflows, 'MainHolidays.id');

					strategyData.callflows.MainCallflow.flow.children._ = {
						children: {},
						data: {
							id: holidayCallflowId
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
		},

		strategyHolidaysDeleteRuleSetAndRules: function(id, globalCallback) {
			var self = this;

			self.strategyGetRuleSet(id, function(data) {
				var parallelRequests = {};

				_.each(data.temporal_rules, function(id) {
					parallelRequests[id] = function(callback) {
						self.strategyHolidaysDeleteHoliday(id, function() {
							callback && callback(null, {});
						});
					};
				});

				monster.parallel(parallelRequests, function(err, results) {
					self.strategyHolidaysDeleteRuleSet(id, function(data) {
						globalCallback && globalCallback(data);
					});
				});
			});
		},

		strategyHolidaysUpdateHoliday: function(data, callback) {
			var self = this;

			if (data.id) {
				self.callApi({
					resource: 'temporalRule.update',
					data: {
						accountId: self.accountId,
						ruleId: data.id,
						data: data
					},
					success: function(data, status) {
						callback(data.data);
					}
				});
			} else {
				self.strategyHolidaysCreateHoliday(data, function(data) {
					callback(data);
				});
			}
		},

		strategyHolidaysCreateRuleSet: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'temporalSet.create',
				data: {
					accountId: self.accountId,
					data: data
				},
				success: function(data, status) {
					callback(data.data);
				}
			});
		},

		strategyHolidaysDeleteRuleSet: function(id, callback) {
			var self = this;

			self.callApi({
				resource: 'temporalSet.delete',
				data: {
					accountId: self.accountId,
					setId: id
				},
				success: function(data, status) {
					callback && callback(data.data);
				}
			});
		},

		strategyHolidaysCreateHoliday: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'temporalRule.create',
				data: {
					accountId: self.accountId,
					data: data
				},
				success: function(data, status) {
					callback(data.data);
				}
			});
		},

		strategyHolidaysDeleteHoliday: function(id, callback) {
			var self = this;

			self.callApi({
				resource: 'temporalRule.delete',
				data: {
					accountId: self.accountId,
					ruleId: id,
					generateError: false
				},
				success: function(data, status) {
					callback(data.data);
				},
				error: function(data, status) {
					callback(data.data);
				}
			});
		}
	};
});
