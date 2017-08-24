define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster');

	var app = {
		requests: {},

		appFlags: {
			callLogs: {
				devices: []
			}
		},

		subscribe: {
			'voip.callLogs.render': 'callLogsRender'
		},

		callLogsRender: function(args) {
			var self = this;

			self.callLogsGetData(function() {
				self.callLogsRenderContent(args.parent, args.fromDate, args.toDate, args.type, args.callback);
			});
		},

		callLogsGetData: function(globalCallback) {
			var self = this;

			monster.parallel({
				devices: function(callback) {
					self.callLogsListDevices(function(devices) {
						callback && callback(null, devices);
					});
				}
			}, function(err, results) {
				self.appFlags.callLogs.devices = _.keyBy(results.devices, 'id');

				globalCallback && globalCallback();
			});
		},

		callLogsRenderContent: function(parent, fromDate, toDate, type, callback) {
			var self = this,
				template,
				defaultDateRange = 1,
				maxDateRange = 31;

			if (!toDate && !fromDate) {
				var dates = monster.util.getDefaultRangeDates(defaultDateRange);
				fromDate = dates.from;
				toDate = dates.to;
			}

			var dataTemplate = {
				timezone: 'GMT' + jstz.determine_timezone().offset(),
				type: type || 'today',
				fromDate: fromDate,
				toDate: toDate,
				showFilteredDates: ['thisMonth', 'thisWeek'].indexOf(type) >= 0,
				showReport: monster.config.whitelabel.callReportEmail ? true : false
			};

			self.callLogsGetCdrs(fromDate, toDate, function(cdrs, nextStartKey) {
				cdrs = self.callLogsFormatCdrs(cdrs);

				dataTemplate.cdrs = cdrs;
				template = $(monster.template(self, 'callLogs-layout', dataTemplate));
				monster.ui.tooltips(template);

				if (cdrs && cdrs.length) {
					var cdrsTemplate = $(monster.template(self, 'callLogs-cdrsList', {cdrs: cdrs, showReport: monster.config.whitelabel.callReportEmail ? true : false}));
					template.find('.call-logs-grid .grid-row-container')
							.append(cdrsTemplate);
				}

				var optionsDatePicker = {
					container: template,
					range: maxDateRange
				};

				monster.ui.initRangeDatepicker(optionsDatePicker);

				template.find('#startDate').datepicker('setDate', fromDate);
				template.find('#endDate').datepicker('setDate', toDate);

				if (!nextStartKey) {
					template.find('.call-logs-loader').hide();
				}

				self.callLogsBindEvents({
					template: template,
					cdrs: cdrs,
					fromDate: fromDate,
					toDate: toDate,
					nextStartKey: nextStartKey
				});

				monster.ui.tooltips(template);

				parent
					.empty()
					.append(template);

				callback && callback();
			});
		},

		callLogsBindEvents: function(params) {
			var self = this,
				template = params.template,
				cdrs = params.cdrs,
				fromDate = params.fromDate,
				toDate = params.toDate,
				startKey = params.nextStartKey;
console.log(cdrs);
			setTimeout(function() {
				template.find('.search-query').focus();
			});

			template.find('.apply-filter').on('click', function(e) {
				var fromDate = template.find('input.filter-from').datepicker('getDate'),
					toDate = template.find('input.filter-to').datepicker('getDate');

				self.callLogsRenderContent(template.parents('.right-content'), fromDate, toDate, 'custom');
			});

			template.find('.fixed-ranges button').on('click', function(e) {
				var $this = $(this),
					type = $this.data('type');

				// We don't really need to do that, but it looks better to the user if we still remove/add the classes instantly.
				template.find('.fixed-ranges button').removeClass('active');
				$this.addClass('active');

				if (type !== 'custom') {
					// Without this, it doesn't look like we're refreshing the data.
					// GOod way to solve it would be to separate the filters from the call logs view, and only refresh the call logs.
					template.find('.call-logs-content').empty();

					var dates = self.callLogsGetFixedDatesFromType(type);
					self.callLogsRenderContent(template.parents('.right-content'), dates.from, dates.to, type);
				} else {
					template.find('.fixed-ranges-date').hide();
					template.find('.custom-range').addClass('active');
				}
			});

			template.find('.download-csv').on('click', function(e) {
				var fromDateTimestamp = monster.util.dateToBeginningOfGregorianDay(fromDate),
					toDateTimestamp = monster.util.dateToEndOfGregorianDay(toDate),
					url = self.apiUrl + 'accounts/' + self.accountId + '/cdrs?created_from=' + fromDateTimestamp + '&created_to=' + toDateTimestamp + '&accept=text/csv&auth_token=' + self.getAuthToken();

				window.open(url, '_blank');
			});

			template.find('.search-div input.search-query').on('keyup', function(e) {
				if (template.find('.grid-row-container .grid-row').length > 0) {
					var searchValue = $(this).val().replace(/\|/g, '').toLowerCase(),
						matchedResults = false;

					if (searchValue.length <= 0) {
						template.find('.grid-row-group').show();
						matchedResults = true;
					} else {
						_.each(cdrs, function(cdr) {
							var searchString = (cdr.date + '|' + cdr.fromName + '|' + cdr.fromNumber + '|' + cdr.toName + '|'
											+ cdr.toNumber + '|' + cdr.hangupCause + '|' + cdr.id).toLowerCase(),
								rowGroup = template.find('.grid-row.main-leg[data-id="' + cdr.id + '"]').parents('.grid-row-group');

							if (searchString.indexOf(searchValue) >= 0) {
								matchedResults = true;
								rowGroup.show();
							} else {
								rowGroup.hide();
							}
						});
					}

					if (matchedResults) {
						template.find('.grid-row.no-match').hide();
					} else {
						template.find('.grid-row.no-match').show();
					}
				}
			});

			template.on('click', '.grid-row.main-leg', function(e) {
				var $this = $(this),
					rowGroup = $this.parents('.grid-row-group'),
					callId = $this.data('id'),
					extraLegs = rowGroup.find('.extra-legs');

				if (rowGroup.hasClass('open')) {
					rowGroup.removeClass('open');
					extraLegs.slideUp();
				} else {
					// Reset all slidedDown legs
					template.find('.grid-row-group').removeClass('open');
					template.find('.extra-legs').slideUp();

					// Slide down current leg
					rowGroup.addClass('open');
					extraLegs.slideDown();

					if (!extraLegs.hasClass('data-loaded')) {
						self.callLogsGetLegs(callId, function(cdrs) {
							var formattedCdrs = self.callLogsFormatCdrs(cdrs);

							rowGroup.find('.extra-legs')
									.empty()
									.addClass('data-loaded')
									.append(monster.template(self, 'callLogs-interactionLegs', { cdrs: formattedCdrs }));
						});
					}
				}
			});

			template.on('click', '.grid-cell.actions .details-cdr', function(e) {
				e.stopPropagation();
				var cdrId = $(this).parents('.grid-row').data('id');
				self.callLogsShowDetailsPopup(cdrId);
			});

			template.on('click', '.grid-cell.report a', function(e) {
				e.stopPropagation();
			});

			function loadMoreCdrs() {
				var loaderDiv = template.find('.call-logs-loader'),
					cdrsTemplate;

				if (startKey) {
					loaderDiv.toggleClass('loading');
					loaderDiv.find('.loading-message > i').toggleClass('fa-spin');
					self.callLogsGetCdrs(fromDate, toDate, function(newCdrs, nextStartKey) {
						newCdrs = self.callLogsFormatCdrs(newCdrs);
						cdrsTemplate = $(monster.template(self, 'callLogs-cdrsList', {
							cdrs: newCdrs,
							showReport: monster.config.whitelabel.callReportEmail ? true : false
						}));

						startKey = nextStartKey;
						if (!startKey) {
							template.find('.call-logs-loader').hide();
						}

						template.find('.call-logs-grid .grid-row-container').append(cdrsTemplate);

						cdrs = cdrs.concat(newCdrs);
						var searchInput = template.find('.search-div input.search-query');
						if (searchInput.val()) {
							searchInput.keyup();
						}

						loaderDiv.toggleClass('loading');
						loaderDiv.find('.loading-message > i').toggleClass('fa-spin');
					}, startKey);
				} else {
					loaderDiv.hide();
				}
			}

			template.find('.call-logs-grid').on('scroll', function(e) {
				var $this = $(this);
				if ($this.scrollTop() === $this[0].scrollHeight - $this.innerHeight()) {
					loadMoreCdrs();
				}
			});

			template.find('.call-logs-loader:not(.loading) .loader-message').on('click', function(e) {
				loadMoreCdrs();
			});
		},

		// Function built to return JS Dates for the fixed ranges.
		callLogsGetFixedDatesFromType: function(type) {
			var self = this,
				from = new Date(),
				to = new Date();

			if (type === 'thisWeek') {
				// First we need to know how many days separate today and monday.
					// Since Sunday is 0 and Monday is 1, we do this little substraction to get the result.
				var day = from.getDay(),
					countDaysFromMonday = (day || 7) - 1;

				from.setDate(from.getDate() - countDaysFromMonday);
			} else if (type === 'thisMonth') {
				from.setDate(1);
			}

			return {
				from: from,
				to: to
			};
		},

		callLogsGetCdrs: function(fromDate, toDate, callback, pageStartKey) {
			var self = this,
				fromDateTimestamp = monster.util.dateToBeginningOfGregorianDay(fromDate),
				toDateTimestamp = monster.util.dateToEndOfGregorianDay(toDate),
				filters = {
					'created_from': fromDateTimestamp,
					'created_to': toDateTimestamp,
					'page_size': 50
				};

			if (pageStartKey) {
				filters.start_key = pageStartKey;
			}

			self.callApi({
				resource: 'cdrs.listByInteraction',
				data: {
					accountId: self.accountId,
					filters: filters
				},
				success: function(data, status) {
					callback(data.data, data.next_start_key);
				}
			});
		},

		callLogsGetLegs: function(callId, callback) {
			var self = this;

			self.callApi({
				resource: 'cdrs.listLegs',
				data: {
					accountId: self.accountId,
					callId: callId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		callLogsFormatCdrs: function(cdrs) {
			var self = this,
				result = [],
				deviceIcons = {
					'cellphone': 'fa fa-phone',
					'smartphone': 'icon-telicon-mobile-phone',
					'landline': 'icon-telicon-home',
					'mobile': 'icon-telicon-sprint-phone',
					'softphone': 'icon-telicon-soft-phone',
					'sip_device': 'icon-telicon-voip-phone',
					'sip_uri': 'icon-telicon-voip-phone',
					'fax': 'icon-telicon-fax',
					'ata': 'icon-telicon-ata',
					'unknown': 'fa fa-circle'
				},
				formatCdr = function(cdr) {
					var date = cdr.hasOwnProperty('channel_created_time') ? monster.util.unixToDate(cdr.channel_created_time, true) : monster.util.gregorianToDate(cdr.timestamp),
						shortDate = monster.util.toFriendlyDate(date, 'shortDate'),
						time = monster.util.toFriendlyDate(date, 'time'),
						durationMin = parseInt(cdr.duration_seconds / 60).toString(),
						durationSec = (cdr.duration_seconds % 60 < 10 ? '0' : '') + (cdr.duration_seconds % 60),
						hangupI18n = self.i18n.active().hangupCauses,
						hangupHelp = '',
						isOutboundCall = 'authorizing_id' in cdr && cdr.authorizing_id.length > 0;

					// Only display help if it's in the i18n.
					if (hangupI18n.hasOwnProperty(cdr.hangup_cause)) {
						if (isOutboundCall && hangupI18n[cdr.hangup_cause].hasOwnProperty('outbound')) {
							hangupHelp += hangupI18n[cdr.hangup_cause].outbound;
						} else if (!isOutboundCall && hangupI18n[cdr.hangup_cause].hasOwnProperty('inbound')) {
							hangupHelp += hangupI18n[cdr.hangup_cause].inbound;
						}
					}

					var call = {
						id: cdr.id,
						callId: cdr.call_id,
						timestamp: cdr.timestamp,
						date: shortDate,
						time: time,
						fromName: cdr.caller_id_name,
						fromNumber: cdr.caller_id_number || cdr.from.replace(/@.*/, ''),
						toName: cdr.callee_id_name,
						toNumber: cdr.callee_id_number || ('request' in cdr) ? cdr.request.replace(/@.*/, '') : cdr.to.replace(/@.*/, ''),
						duration: durationMin + ':' + durationSec,
						hangupCause: cdr.hangup_cause,
						hangupHelp: hangupHelp,
						isOutboundCall: isOutboundCall,
						mailtoLink: 'mailto:' + monster.config.whitelabel.callReportEmail
								+ '?subject=Call Report: ' + cdr.call_id
								+ '&body=Please describe the details of the issue:%0D%0A%0D%0A'
								+ '%0D%0A____________________________________________________________%0D%0A'
								+ '%0D%0AAccount ID: ' + self.accountId
								+ '%0D%0AFrom (Name): ' + (cdr.caller_id_name || '')
								+ '%0D%0AFrom (Number): ' + (cdr.caller_id_number || cdr.from.replace(/@.*/, ''))
								+ '%0D%0ATo (Name): ' + (cdr.callee_id_name || '')
								+ '%0D%0ATo (Number): ' + (cdr.callee_id_number || ('request' in cdr) ? cdr.request.replace(/@.*/, '') : cdr.to.replace(/@.*/, ''))
								+ '%0D%0ADate: ' + shortDate
								+ '%0D%0ADuration: ' + durationMin + ':' + durationSec
								+ '%0D%0AHangup Cause: ' + (cdr.hangup_cause || '')
								+ '%0D%0ACall ID: ' + cdr.call_id
								+ '%0D%0AOther Leg Call ID: ' + (cdr.other_leg_call_id || '')
								+ '%0D%0AHandling Server: ' + (cdr.media_server || '')
					};

					if (cdr.hasOwnProperty('channel_created_time')) {
						call.channelCreatedTime = cdr.channel_created_time;
					}

					if (cdr.hasOwnProperty('custom_channel_vars') && cdr.custom_channel_vars.hasOwnProperty('authorizing_id') && self.appFlags.callLogs.devices.hasOwnProperty(cdr.custom_channel_vars.authorizing_id)) {
						var device = self.appFlags.callLogs.devices[cdr.custom_channel_vars.authorizing_id];

						call.formatted = call.formatted || {};
						call.formatted.deviceIcon = deviceIcons[device.device_type];
						call.formatted.deviceTooltip = self.i18n.active().devices.types[device.device_type];

						if (cdr.call_direction === 'inbound') {
							call.formatted.fromDeviceName = device.name;
						} else {
							call.formatted.toDeviceName = device.name;
						}
					}

					return call;
				};

			_.each(cdrs, function(v) {
				result.push(formatCdr(v));
			});

			// In this automagic function... if field doesn't have channelCreateTime, it's because it's a "Main Leg" (legs listed on the first listing, not details)
			// if it's a "main leg" we sort by descending timestamp.
			// if it's a "detail leg", then it has a channelCreatedTime attribute set, and we sort on this as it's more precise. We sort it ascendingly so the details of the calls go from top to bottom in the UI
			result.sort(function(a, b) {
				return (a.hasOwnProperty('channelCreatedTime') && b.hasOwnProperty('channelCreatedTime')) ? (a.channelCreatedTime > b.channelCreatedTime ? 1 : -1) : (a.timestamp > b.timestamp ? -1 : 1);
			});

			return result;
		},

		callLogsShowDetailsPopup: function(callLogId) {
			var self = this;
			self.callApi({
				resource: 'cdrs.get',
				data: {
					accountId: self.accountId,
					cdrId: callLogId
				},
				success: function(data, status) {
					var template = $(monster.template(self, 'callLogs-detailsPopup'));

					monster.ui.renderJSON(data.data, template.find('#jsoneditor'));

					monster.ui.dialog(template, { title: self.i18n.active().callLogs.detailsPopupTitle });
				},
				error: function(data, status) {
					monster.ui.alert('error', self.i18n.active().callLogs.alertMessages.getDetailsError);
				}
			});
		},

		callLogsListDevices: function(callback) {
			var self = this;

			self.callApi({
				resource: 'device.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: false
					}
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		}
	};

	return app;
});
