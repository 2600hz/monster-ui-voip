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
			self.strategyHolidaysBindEvents($container, template, holidaysData);

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
				var endYear = _.get(value, 'holidayData.endYear', yearSelected);

				if (endYear === yearSelected) {
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

		strategyHolidaysBindEvents: function(parent, template, holidaysData) {
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
				var table = footable.get('#holidays_list_table');

				/*empty table before loading the rows for the year selected*/
				table.rows.load([]);
				self.strategyHolidaysListingRender(parent, holidaysData);
			});

			template.on('click', '.add-holiday', function(event) {
				event.preventDefault();

				monster.pub('voip.strategy.addEditOfficeHolidays', {
					yearSelected: parseInt(parent.find('#year').val()),
					existingHolidays: _.map(self.appFlags.strategyHolidays.allHolidays, function(holiday) {
						return {
							id: holiday.holidayData.id,
							name: holiday.holidayData.name
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

				/*var parent = $(this).parents('.element-container'),
					mainCallflow = strategyData.callflows.MainCallflow,
					holidaysEnabled = parent.find('.holidays-toggler input[type="checkbox"]')[0].checked,
					holidayRulesRequests = {},
					invalidData = false;

				if (holidaysEnabled) {
					_.each(parent.find('.holidays-element'), function() {
						var holidayRule = self.strategyHolidaysBuildHolidayRule($(this), holidayRulesRequests);

						if (!holidayRule) {
							invalidData = true;
							return false;
						}

						holidayRulesRequests[holidayRule.name] = function(callback) {
							// ghetto strategyBuildHoliday builds a complete different object for a range, so we check if one of the different key is in there, if yes, this is a range spanning multiple months
							if (holidayRule.hasOwnProperty('isRange')) {
								self.strategyHolidaysBuildMultiMonthRangeHoliday(holidayRule, function(data) {
									data.viewData = holidayRule;
									callback && callback(null, data);
								});
							} else {
								self.strategyHolidaysCleanUpdateHoliday(holidayRule, function(data) {
									callback && callback(null, data);
								});
							}
						};
					});

					if (invalidData) {
						monster.ui.alert(self.i18n.active().strategy.alertMessages.uniqueHoliday);
					} else {
						monster.parallel(holidayRulesRequests, function(err, results) {
							// First extract all ids from the new holidayList
							var existingHolidaysCallflowsIds = [],
								newHolidayCallflowsIds = _.map(holidayRulesRequests, 'id');

							// Find all IDs of existing Callflows in the Main Callflow that are linking to the Main Holidays
							_.each(mainCallflow.flow.children, function(directChild, id) {
								if (id !== '_' && directChild.data.id === strategyData.callflows.MainHolidays.id) {
									existingHolidaysCallflowsIds.push(id);
								}
							});

							// Now see if any of these existing IDs that are no longer in the list of holidays
							// If we find orphans, remove them from the main callflow
							_.each(existingHolidaysCallflowsIds, function(id) {
								if (newHolidayCallflowsIds.indexOf(id) < 0) {
									delete mainCallflow.flow.children[id];
								}
							});

							_.each(results, function(val, key) {
								mainCallflow.flow.children[val.id] = {
									children: {},
									data: {
										id: strategyData.callflows.MainHolidays.id
									},
									module: 'callflow'
								};
								_.set(strategyData.temporalRules, ['holidays', val.name], val);
							});

							self.strategyRebuildMainCallflowRuleArray(strategyData);
							self.strategyUpdateCallflow(mainCallflow, function(updatedCallflow) {
								strategyData.callflows.MainCallflow = updatedCallflow;
								parent.find('.element-content').hide();
								parent.removeClass('open');
								monster.ui.toast({
									type: 'success',
									message: self.i18n.active().strategy.toastrMessages.updateHolidaySuccess
								});
							});
						});
					}
				} else {
					monster.ui.confirm(self.i18n.active().strategy.confirmMessages.disableHolidays, function() {
						_.each(_.get(strategyData.temporalRules, 'holidays', {}), function(val, key) {
							holidayRulesRequests[key] = function(callback) {
								if (val.hasOwnProperty('temporal_rules')) {
									self.strategyHolidaysDeleteRuleSetAndRules(val.id, function() {
										delete mainCallflow.flow.children[val.id];
										callback(null, {});
									});
								} else {
									self.strategyHolidaysDeleteHoliday(val.id, function() {
										delete mainCallflow.flow.children[val.id];
										callback(null, {});
									});
								}
							};
						});

						monster.parallel(holidayRulesRequests, function(err, results) {
							_.set(strategyData.temporalRules, 'holidays', {});
							self.strategyRebuildMainCallflowRuleArray(strategyData);
							self.strategyUpdateCallflow(mainCallflow, function(updatedCallflow) {
								strategyData.callflows.MainCallflow = updatedCallflow;
								parent.find('.element-content').hide();
								parent.removeClass('open');
								monster.ui.toast({
									type: 'success',
									message: self.i18n.active().strategy.toastrMessages.updateHolidaySuccess
								});
							});
						});
					});
				}*/
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
					allHolidays = self.appFlags.strategyHolidays.allHolidays,
					holidayRuleId = _.findKey(allHolidays, function(holiday) {
						return holiday.holidayData.id === id;
					}),
					holidayRule = allHolidays[holidayRuleId];

				monster.pub('voip.strategy.addEditOfficeHolidays', {
					yearSelected: parseInt(parent.find('#year').val()),
					existingHolidays: _.map(self.appFlags.strategyHolidays.allHolidays, function(holiday) {
						return {
							id: holiday.holidayData.id,
							name: holiday.holidayData.name
						};
					}),
					holidayRule: holidayRule,
					callback: function(err, data) {
						self.appFlags.strategyHolidays.allHolidays[holidayRuleId] = data;

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
					allHolidays = self.appFlags.strategyHolidays.allHolidays,
					holidayRuleId = _.findKey(allHolidays, function(holiday) {
						return holiday.holidayData.id === holidayId;
					});

				delete allHolidays.splice(holidayRuleId, 1);

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
				var endDate = _.get(val, 'end_date');

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
						holidayData.endDate = monster.util.gregorianToDate(endDate);
						holidayData.recurring = false;
					}
					holidaysData.push({ holidayType: holidayType, holidayData: holidayData });
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

		strategyHolidaysCleanUpdateHoliday: function(data, callback) {
			var self = this,
				updateHoliday = function() {
					delete data.extra;

					self.strategyHolidaysUpdateHoliday(data, function(data) {
						callback && callback(data);
					});
				};

			if (data.extra.oldType === 'set') {
				self.strategyHolidaysDeleteRuleSetAndRules(data.id, function() {
					delete data.id;

					updateHoliday();
				});
			} else {
				updateHoliday();
			}
		},

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
						days = [];

					for (var day = fromDay; day <= toDay; day++) {
						days.push(day);
					}

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

					self.strategyCreateRuleSet(ruleSet, function(data) {
						globalCallback(data);
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

		strategyHolidaysBuildHolidayRule: function(template, rules) {
			var self = this,
				$this = $(template),
				name = $this.find('#name').val().trim(),
				month = parseInt($this.find('.month.from :selected').val()),
				toMonth = parseInt($this.find('.month.to :selected').val()),
				fromDay = parseInt($this.find('.day.from :selected').val()),
				toDay = parseInt($this.find('.day.to :selected').val()),
				ordinal = $this.find('.ordinal :selected').val(),
				wday = $this.find('.wday :selected').val(),
				id = $this.data('id'),
				type = $this.data('type'),
				holidayRule = {};

			if (!name || _.keys(rules).indexOf(name) >= 0) {
				holidayRule = false;
			} else if (toMonth && month !== toMonth) {
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
					var firstDay = fromDay;
					holidayRule.days = [firstDay];
					if (toDay) {
						for (var day = firstDay + 1; day <= toDay; day++) {
							holidayRule.days.push(day);
						}
					}
				} else {
					holidayRule.ordinal = ordinal;
					holidayRule.wdays = [wday];
				}
			}

			if (id) {
				holidayRule.id = id;
			}

			holidayRule.extra = {
				oldType: type
			};

			return holidayRule;
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
			}
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
				// Sometimes we'll try to delete a time of day which no longer exist, but still need to execute the callback
				error: function(data, status) {
					callback(data.data);
				}
			});
		}
	};
});
