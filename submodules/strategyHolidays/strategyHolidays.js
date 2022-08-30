define(function(require) {
	var monster = require('monster'),
		_ = require('lodash'),
		$ = require('jquery'),
		footable = require('footable'),
		Papa = require('papaparse'),
		sugar = require('sugar-date'),
		DateHolidays = require('date-holidays');

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
				],
				dateTypes: ['single', 'range', 'advanced'],
				csvExport: {
					filename: 'template-office-holidays',
					sampleTemplate: [
						{
							type: 'single',
							name: 'single_template',
							start_date: 'February 14',
							end_date: '',
							year: '',
							recurring: 'yes'
						},
						{
							type: 'range',
							name: 'range_template',
							start_date: 'October 10',
							end_date: 'October 12',
							year: new Date().getFullYear(),
							recurring: 'no'
						},
						{
							type: 'advanced',
							name: 'advanced_template',
							start_date: 'Second Friday of March',
							end_date: '',
							year: '',
							recurring: 'yes'
						}
					]
				}
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

			self.strategyHolidaysListingRender($container);
			self.strategyHolidaysBindEvents($container, template, holidaysData, strategyData);

			callback && callback();
		},

		strategyHolidaysListingRender: function($container) {
			var self = this,
				holidaysData = self.appFlags.strategyHolidays.allHolidays,
				table = footable.get('#holidays_list_table'),
				yearSelected = parseInt($container.find('#year').val()),
				holidaysDataArray = [],
				initTemplate = function initTemplate(data, key) {
					var getDateToDisplay = function getDateToDisplay($container, data) {
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

							return {
								text: dateToText,
								timestamp: data.holidayType === 'advanced'
									? Sugar.Date.create(dateToText).getTime()
									: date.getTime()
							};
						},
						dateToDisplay = getDateToDisplay($container, data),
						template = $(self.getTemplate({
							name: 'listing',
							data: {
								holidayType: data.holidayType,
								holidayData: data.holidayData,
								dateToDisplay: _.get(dateToDisplay, 'text'),
								timestamp: _.get(dateToDisplay, 'timestamp'),
								key: key
							},
							submodule: 'strategyHolidays'
						}));

					self.strategyHolidaysListingBindEvents($container, template);

					return template;
				};

			_.forEach(holidaysData, function(value, key) {
				var endYear = _.get(value, 'holidayData.endYear', yearSelected),
					excludeYear = _.get(value, 'holidayData.excludeYear', []);

				if (endYear === yearSelected && !_.includes(excludeYear, yearSelected)) {
					holidaysDataArray.push(initTemplate(value, key));
				}
			});

			/*empty table before loading the rows for the year selected*/
			table.rows.load(holidaysDataArray);
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

			self.strategyHolidaysDeleteDialogBindEvents(template, parent, popup, data);
		},

		strategyHolidaysIncludeNationalHolidaysRender: function(parent, data) {
			var self = this,
				$template = $(self.getTemplate({
					name: 'includeNationalHolidays',
					data: data,
					submodule: 'strategyHolidays'
				})),
				popup = monster.ui.dialog($template, {
					autoScroll: false,
					title: self.i18n.active().strategy.holidays.importNationalOfficeHolidays.title
				});

			self.strategyHolidaysUpdateNationalHolidaysRender(parent, $template, data.holidays);
			self.strategyHolidaysIncludeNationalHolidaysBindEvents(parent, $template, popup);
		},

		strategyHolidaysUpdateNationalHolidaysRender: function(parent, parentTemplate, data) {
			var self = this,
				holidaysListForSelectedYear = self.strategyHolidaysGetHolidaysForCurrentYear(parent),
				importedHolidaysNames = _.map(holidaysListForSelectedYear, 'name'),
				$template = $(self.getTemplate({
					name: 'importNationalHolidaysList',
					data: {
						holidays: data
					},
					submodule: 'strategyHolidays'
				}));

			parentTemplate
				.find('.include-holidays-list')
				.replaceWith($template);

			monster.ui.footable($template.find('#include_holidays_table.footable'), {
				filtering: {
					enabled: false
				},
				paging: {
					enabled: false
				}
			});

			var $rows = $template.find('#include_holidays_table tbody tr'),
				totalRows = $rows.length,
				itemsChecked = 0;

			_.forEach($rows, function(row) {
				var $row = $(row),
					name = $row.data('name');

				if (importedHolidaysNames.indexOf(name) > -1) {
					itemsChecked++;
					$row.find('.add-holiday').prop('checked', true);
				}
			});

			$template.find('.check-all').prop('checked', itemsChecked === totalRows);

			self.strategyHolidaysUpdateNationalHolidaysBindEvents($template, data);
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
				self.strategyHolidaysListingRender(parent);
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
					isNew: true,
					holidayRule: {
						holidayData: {
							recurring: true
						}
					},
					callback: function(err, data) {
						self.appFlags.strategyHolidays.allHolidays.push(data);
						self.strategyHolidaysListingRender(parent);
					}
				});
			});

			template.on('click', '.import-csv', function(event) {
				event.preventDefault();
				self.strategyHolidaysImportHolidaysFromCsvData(parent);
			});

			template.on('click', '.include-national-holidays', function(event) {
				event.preventDefault();

				var dateHolidays = new DateHolidays(),
					allCountries = dateHolidays.getCountries(),
					parseCountryCode = _.flow(
						_.partial(_.split, _, '-'),
						_.last
					),
					countryCode = parseCountryCode(monster.config.whitelabel.language),
					defaultCountryCode = parseCountryCode(monster.defaultLanguage),
					selectedCountry = _.has(allCountries, countryCode) ? countryCode : defaultCountryCode,
					holidaysList = new DateHolidays(selectedCountry),
					yearSelected = parent.find('#year').val(),
					data = {
						allCountries: allCountries,
						selectedCountry: selectedCountry,
						holidays: holidaysList.getHolidays(yearSelected)
					};

				self.strategyHolidaysIncludeNationalHolidaysRender(parent, data);
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

							if (holidayId) {
								self.appFlags.strategyHolidays.deletedHolidays.push(holidayId);
							}
						});
						self.appFlags.strategyHolidays.allHolidays = [];
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
					key = $this.parents('tr').data('key'),
					data = {
						holidayName: holidayName,
						holidayId: id,
						holidayKey: key
					};

				self.strategyHolidaysDeleteDialogRender(parent, data);
			});

			template.on('click', '.edit-holiday', function(event) {
				event.preventDefault();

				var $this = $(this),
					key = $this.parents('tr').data('key'),
					yearSelected = parseInt(parent.find('#year').val()),
					allHolidays = self.appFlags.strategyHolidays.allHolidays,
					holidayRule = allHolidays[key];

				monster.pub('voip.strategy.addEditOfficeHolidays', {
					yearSelected: parseInt(parent.find('#year').val()),
					existingHolidays: _.map(allHolidays, function(holiday) {
						return {
							id: _.get(holiday, 'holidayData.id'),
							name: _.get(holiday, 'holidayData.name')
						};
					}),
					holidayRule: holidayRule,
					isNew: false,
					callback: function(err, data) {
						var holidayId = _.get(data, 'holidayData.id');

						if (holidayRule.holidayType === 'range' && data.holidayType !== 'range') {
							if (holidayId) {
								self.appFlags.strategyHolidays.deletedHolidays.push(holidayId);
							}
							delete allHolidays.splice(key, 1);
							self.appFlags.strategyHolidays.allHolidays.push(
								_.omit(data, ['holidayData.id', 'holidayData.set'])
							);
						} else {
							/*Compare old holidayData with new holidayData if it's recurring*/
							var isOldRecurring = _.get(holidayRule, 'holidayData.recurring', false),
								isNewRecurring = _.get(data, 'holidayData.recurring', false);

							if (isOldRecurring && (isOldRecurring !== isNewRecurring)) {
								/* update existing rule */
								if (_.isUndefined(holidayRule.holidayData.excludeYear)) {
									holidayRule.holidayData.excludeYear = [];
								}
								holidayRule.holidayData.excludeYear.push(yearSelected);
								holidayRule.modified = true;
								self.appFlags.strategyHolidays.allHolidays[key] = holidayRule;

								/* add new rule */
								delete data.holidayData.id;
								self.appFlags.strategyHolidays.allHolidays.push(data);
							} else {
								self.appFlags.strategyHolidays.allHolidays[key] = data;
							}
						}

						self.strategyHolidaysListingRender(parent);
					}
				});
			});
		},

		strategyHolidaysDeleteDialogBindEvents: function(template, parent, popup, data) {
			var self = this;

			template.find('.cancel').on('click', function(event) {
				popup.dialog('close').remove();
			});

			template.find('.delete').on('click', function(event) {
				event.preventDefault();

				var yearSelected = parseInt(parent.find('#year').val()),
					isChecked = template.find('.deleteAll').prop('checked'),
					allHolidays = self.appFlags.strategyHolidays.allHolidays,
					holidayRule = allHolidays[data.holidayKey],
					isRecurring = _.get(holidayRule, 'holidayData.recurring', false),
					holidayKey = data.holidayKey;

				if ((isRecurring && isChecked) || !isRecurring) {
					if (data.holidayId) {
						self.appFlags.strategyHolidays.deletedHolidays.push(data.holidayId);
					}
					delete allHolidays.splice(holidayKey, 1);
				} else {
					if (_.isUndefined(holidayRule.holidayData.excludeYear)) {
						holidayRule.holidayData.excludeYear = [];
					}
					holidayRule.modified = true;
					holidayRule.holidayData.excludeYear.push(yearSelected);

					self.appFlags.strategyHolidays.allHolidays[holidayKey] = holidayRule;
				}

				self.strategyHolidaysListingRender(parent);
				popup.dialog('close').remove();
			});
		},

		strategyHolidaysIncludeNationalHolidaysBindEvents: function(parent, template, popup) {
			var self = this;

			template.find('.cancel').on('click', function(event) {
				popup.dialog('close').remove();
			});

			template.find('.countries').on('change', function(event) {
				event.preventDefault();

				var $this = $(this),
					country = $this.val(),
					yearSelected = parent.find('#year').val(),
					holidayDates = new DateHolidays(country),
					holidays = holidayDates.getHolidays(yearSelected);

				self.strategyHolidaysUpdateNationalHolidaysRender(parent, template, holidays);
			});

			template.on('submit', function(event) {
				event.preventDefault();

				var $rowsChecked = template.find('#include_holidays_table tbody tr .add-holiday:checked'),
					$rowsUnchecked = template.find('#include_holidays_table tbody tr .add-holiday:not(:checked)'),
					holidaysListForSelectedYear = self.strategyHolidaysGetHolidaysForCurrentYear(parent),
					importedHolidaysNames = _.map(holidaysListForSelectedYear, 'name'),
					allHolidays = self.appFlags.strategyHolidays.allHolidays,
					holidaysData = _
						.chain($rowsChecked)
						.map(function(row) {
							var $tr = $(row).parents('tr');

							return _.pick($tr.data(), [
								'date',
								'name'
							]);
						})
						.reject(_.flow(
							_.partial(_.get, _, 'name'),
							_.partial(_.includes, importedHolidaysNames)
						))
						.value(),
					keysToDelete = [];

				_.forEach($rowsUnchecked, function(row) {
					var $row = $(row),
						name = $row.parents('tr').data('name'),
						holidayExists = _.find(holidaysListForSelectedYear, { 'name': name }),
						holidayId = _.get(holidayExists, 'id'),
						holidayKey = _.get(holidayExists, 'key');

					if (holidayExists) {
						keysToDelete.push(holidayKey);

						if (holidayId) {
							self.appFlags.strategyHolidays.deletedHolidays.push(holidayId);
						}
					}
				});

				_.forEach(keysToDelete.sort((a, b) => b - a), function(key) {
					delete allHolidays.splice(key, 1);
				});

				self.strategyHolidaysIncludeHolidaysForCountry(parent, holidaysData);
				popup.dialog('close').remove();
			});
		},

		strategyHolidaysUpdateNationalHolidaysBindEvents: function(template, data) {
			var self = this;

			template.find('.check-all').on('click', function(event) {
				var $this = $(this),
					isChecked = $this.prop('checked'),
					$rows = $this.parents('#include_holidays_table').find('tbody tr');

				_.forEach($rows, function(row) {
					var $row = $(row);

					$row.find('.add-holiday').prop('checked', isChecked);
				});
			});

			template.find('.add-holiday').on('click', function(event) {
				var $this = $(this),
					totalRows = data.length,
					$rows = $this.parents('#include_holidays_table').find('tbody tr .add-holiday:checked'),
					itemsChecked = $rows.length;

				$this.parents('table').find('.check-all').prop('checked', itemsChecked === totalRows);
			});
		},

		strategyHolidaysGetHolidaysForCurrentYear: function(parent) {
			var self = this,
				allHolidays = self.appFlags.strategyHolidays.allHolidays,
				yearSelected = parseInt(parent.find('#year').val()),
				isCurrentYear = _.flow(
					_.partial(_.get, _, 'endYear'),
					_.partial(_.isEqual, _, yearSelected)
				),
				isImported = _.partial(_.get, _, 'isImported'),
				importedHolidaysList = _
					.chain(allHolidays)
					.map(function(holiday, key) {
						var holidayData = _.get(holiday, 'holidayData');

						return _.merge({
							key: key
						}, _.pick(holidayData, [
							'id',
							'name',
							'endYear',
							'isImported'
						]));
					})
					.filter(_.overEvery(
						isCurrentYear,
						isImported
					))
					.value();

			return importedHolidaysList;
		},

		strategyHolidaysImportHolidaysFromCsvData: function(parent) {
			var self = this,
				i18n = self.i18n.active().strategy.holidays,
				appFlags = self.appFlags.strategyHolidays,
				filename = appFlags.csvExport.filename + '.csv',
				data = appFlags.csvExport.sampleTemplate,
				csv = Papa.unparse(data, {
					quotes: true
				}),
				blob = new Blob([csv], {
					type: 'text/csv;charset=utf-8;'
				}),
				dateTypes = appFlags.dateTypes,
				ordinals = _.keys(i18n.ordinals),
				sanitizeString = _.flow(
					_.toString,
					_.toLower,
					_.trim
				),
				validateDate = function(date) {
					var formattedDate = Sugar.Date.create(date),
						isValid = formattedDate instanceof Date && !isNaN(formattedDate.getTime());

					return isValid;
				},
				validateAdvancedDate = function(date) {
					var dateArray = _.split(date, ' '),
						ordinalInput = '',
						isOrdinalValid = _.some(dateArray, function(value) {
							ordinalInput = value;
							return _.includes(ordinals, value);
						}),
						setDateToValidate = _.isEmpty(ordinalInput)
							? date
							: _.replace(date, ordinalInput, 'first'),
						formattedDate = Sugar.Date.create(setDateToValidate),
						isValid = formattedDate instanceof Date && !isNaN(formattedDate.getTime());

					return _.every([
						isOrdinalValid,
						isValid
					]);
				},
				allHolidays = self.appFlags.strategyHolidays.allHolidays;

			monster.pub('common.csvUploader.renderPopup', {
				title: i18n.importOfficeHolidays.title,
				file: blob,
				dataLabel: i18n.importOfficeHolidays.dataLabel,
				filename: filename,
				header: ['type', 'name', 'start_date', 'end_date', 'year', 'recurring'],
				row: {
					sanitizer: function(row) {
						return {
							type: sanitizeString(row.type),
							name: _.trim(_.toString(row.name)),
							start_date: sanitizeString(row.start_date),
							end_date: sanitizeString(row.end_date),
							year: _.toInteger(row.year),
							recurring: sanitizeString(row.recurring) === 'yes'
						};
					},
					validator: function(row) {
						var type = row.type,
							start_date = row.start_date,
							end_date = row.end_date,
							isTypeValid = _.includes(dateTypes, type),
							datesValidator = _.get({
								advanced: {
									start: validateAdvancedDate,
									end: _.stubTrue
								},
								range: {
									start: validateDate,
									end: validateDate
								}
							}, type, {
								start: validateDate,
								end: _.stubTrue
							}),
							isStartDateValid = datesValidator.start(start_date),
							isEndDateValid = datesValidator.end(end_date),
							isSameName = _.flow(
								_.partial(_.get, _, 'name'),
								_.partial(_.isEqual, _, row.name)
							),
							isSameYear = _.partial(_.get, _, 'isSameYear'),
							isNameValid = _
								.chain(allHolidays)
								.map(function(holiday, key) {
									var data = _.get(holiday, 'holidayData');

									return _.merge({
										isSameYear: _.get(data, 'recurring')
											? true
											: row.year === data.endYear
									}, _.pick(data, [
										'name'
									]));
								})
								.filter(_.overEvery(
									isSameYear,
									isSameName
								))
								.value();

						return _.every([
							isTypeValid,
							isStartDateValid,
							isEndDateValid,
							_.isEmpty(isNameValid)
						]);
					}
				},
				onSuccess: _.flow(
					_.bind(self.strategyHolidaysExtractHolidaysFromCsvData, self, ordinals),
					_.bind(self.strategyHolidaysListingRender, self, parent)
				)
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

			_.forEach(_.get(strategyData.temporalRules, 'holidays', {}), function(val, key) {
				var endDate = val.hasOwnProperty('viewData')
						? _.get(val, 'viewData.end_date')
						: _.get(val, 'end_date'),
					startTime = _.get(val, 'time_window_start');

				if (val.id in strategyData.callflows.MainCallflow.flow.children) {
					var holidayType,
						holidayData = _.merge({
							id: val.id,
							name: val.name,
							fromMonth: val.month,
							recurring: true,
							isImported: _.get(val, 'isImported', false)
						}, startTime && {
							time_window_start: startTime,
							time_window_stop: _.get(val, 'time_window_stop')
						});

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
			self.appFlags.strategyHolidays.deletedHolidays = [];

			return holidaysData;
		},

		/**
		 * Returns an array of arrays containing intervals for each day of the week.
		 * @param  {Array} csvData
		 * @return {Array[]}
		 */
		strategyHolidaysExtractHolidaysFromCsvData: function(ordinals, csvData) {
			var self = this,
				wdays = self.appFlags.strategyHolidays.wdays;

			return _.map(csvData, function(row) {
				var type = row.type,
					advancedDateDetails = function formattedAdvancedDate(date) {
						var dateArray = _.split(row.start_date, ' '),
							getOrdinal = _.reject(dateArray, function(value) {
								return !_.includes(ordinals, value);
							}),
							ordinal = _.get(getOrdinal, '[0]'),
							updatedDate = _.replace(date, ordinal, 'first');

						return {
							date: Sugar.Date.create(updatedDate),
							ordinal: ordinal
						};
					},
					advancedDetails = advancedDateDetails(row.start_date),
					advancedStartDate = _.get(advancedDetails, 'date'),
					startDate = type === 'advanced'
						? advancedStartDate
						: Sugar.Date.create(row.start_date),
					endDate = type === 'range'
						? Sugar.Date.create(row.end_date)
						: null,
					configsPerType = {
						advanced: {
							ordinal: _.get(advancedDetails, 'ordinal'),
							wday: wdays[advancedStartDate.getDay()]
						},
						range: {
							fromDay: startDate.getDate(),
							toMonth: !_.isNull(endDate) ? endDate.getMonth() + 1 : '',
							toDay: !_.isNull(endDate) ? endDate.getDate() : ''
						},
						single: {
							fromDay: startDate.getDate()
						}
					},
					typeConfig = _.get(configsPerType, row.type),
					endYear = row.year !== 0 ? row.year : new Date().getFullYear(),
					holidayRule = {
						modified: true,
						holidayType: row.type,
						holidayData: _.merge({
							fromMonth: startDate.getMonth() + 1,
							name: row.name,
							recurring: row.recurring
						}, !row.recurring && {
							endYear: endYear
						}, typeConfig)
					};

				self.appFlags.strategyHolidays.allHolidays.push(holidayRule);
				return holidayRule;
			});
		},

		strategyHolidaysIncludeHolidaysForCountry: function(parent, holidaysData) {
			var self = this;

			_.forEach(holidaysData, function(data) {
				var date = Sugar.Date.create(data.date),
					holiday = {
						holidayType: 'single',
						modified: true,
						holidayData: {
							endYear: date.getFullYear(),
							fromDay: date.getDate(),
							fromMonth: date.getMonth() + 1,
							name: data.name,
							recurring: false,
							isImported: true
						}
					};

				self.appFlags.strategyHolidays.allHolidays.push(holiday);
			});

			self.strategyHolidaysListingRender(parent);
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

			//find first selected wday of the month date.getDay()
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
				id = holidayData.id,
				endDate = holidayData.recurring
					? null
					: monster.util.dateToEndOfGregorianDay(self.strategyHolidaysGetEndDate(holidayData.endYear, holiday)),
				holidayRuleConfig = _.merge({
					oldType: holidayData.set ? 'set' : 'rule'
				}, id && {
					id: id,
					end_date: endDate // if it's an existing holiday then always want to set the end_date
				}, holidayData.isImported && {
					isImported: holidayData.isImported
				}, holiday.holidayType === 'single' && _.pick(holidayData, [
					'time_window_start',
					'time_window_stop'
				]), endDate && {
					end_date: endDate
				}),
				holidayRule = {};

			if (toMonth && month !== toMonth) {
				holidayRule = _.merge({}, holidayRuleConfig, {
					isRange: true,
					name: name,
					fromDay: fromDay,
					fromMonth: month,
					toDay: toDay,
					toMonth: toMonth
				});
			} else {
				holidayRule = _.merge({}, holidayRuleConfig, {
					name: name,
					cycle: 'yearly',
					interval: 1,
					month: month,
					type: 'main_holidays'
				});

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

			_.forEach(rulesToCreate, function(rule) {
				parallelRequests[rule.name] = function(callback) {
					self.strategyHolidaysUpdateHoliday(rule, function(data) {
						callback && callback(null, data);
					});
				};
			});

			var createCleanSet = function() {
				// Create All Rules, and then Create Rule Set.
				monster.parallel(parallelRequests, function(err, results) {
					_.forEach(rulesToCreate, function(rule) {
						ruleSet.temporal_rules.push(results[rule.name].id);
					});

					self.strategyHolidaysCreateRuleSet(ruleSet, function(mainData) {
						mainData.oldData = data;
						globalCallback(mainData);
					});
				});
			};

			if (data.hasOwnProperty('id')) {
				if (data.oldType === 'rule') {
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
					var holidayCallflowId = _.get(strategyData.callflows, 'MainHolidays.id');

					_.forEach(actionsByType.toAdd, function(rule) {
						_.set(strategyData.temporalRules, ['holidays', rule.hasOwnProperty('temporal_rules') ? rule.name : rule.id], rule);
						strategyData.callflows.MainCallflow.flow.children[rule.id] = {
							children: {},
							data: {
								id: holidayCallflowId
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

				_.forEach(data.temporal_rules, function(id) {
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
