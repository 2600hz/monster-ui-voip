define(function(require){
	var $ = require('jquery'),
		_ = require('underscore'),
		monster = require('monster');

	var app = {
		requests: {
			'voip.callLogs.listCdrs': {
				url: 'accounts/{accountId}/cdrs?created_from={fromDate}&created_to={toDate}',
				verb: 'GET'
			},
			'voip.callLogs.getCdrsCSV': {
				url: 'accounts/{accountId}/cdrs?created_from={fromDate}&created_to={toDate}',
				verb: 'GET',
				headers: {
					'Accept': 'application/octet-stream'
				}
			}
		},

		subscribe: {
			'voip.callLogs.render': 'callLogsRender'
		},

		callLogsRender: function(args) {
			var self = this;

			self.callLogsRenderContent(args.parent);
		},

		callLogsRenderContent: function(parent, fromDate, toDate) {
			var self = this,
				dataTemplate = {
					timezone: 'GMT' + jstz.determine_timezone().offset()
				},
				template,
				defaultDateRange = 1,
				maxDateRange = 31;

			if(!toDate && !fromDate) {
				var dates = monster.util.getDefaultRangeDates(defaultDateRange);
				fromDate = dates.from;
				toDate = dates.to;
			}

			// Reset variables used to link A-Legs & B-Legs sent by different pages in the API
			delete self.lastALeg;
			delete self.loneBLegs;
			self.callLogsGetCdrs(fromDate, toDate, function(cdrs, nextStartKey) {
				cdrs = self.callLogsFormatCdrs(cdrs);
				dataTemplate.cdrs = cdrs;
				template = $(monster.template(self, 'callLogs-layout', dataTemplate));

				if(cdrs && cdrs.length) {
					var cdrsTemplate = $(monster.template(self, 'callLogs-cdrsList', {cdrs: cdrs}));
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

				if(!nextStartKey) {
					template.find('.call-logs-loader').hide();
				}

				self.callLogsBindEvents({
					template: template,
					cdrs: cdrs,
					fromDate: fromDate,
					toDate: toDate,
					nextStartKey: nextStartKey
				});

				parent
					.empty()
					.append(template);
			});
		},

		callLogsBindEvents: function(params) {
			var self = this,
				template = params.template,
				cdrs = params.cdrs,
				fromDate = params.fromDate,
				toDate = params.toDate,
				startKey = params.nextStartKey;

			template.find('.filter-div .apply-filter').on('click', function(e) {
				var fromDate = template.find('.filter-div input.filter-from').datepicker("getDate"),
					toDate = template.find('.filter-div input.filter-to').datepicker("getDate");

				self.callLogsRenderContent(template.parents('.right-content'), fromDate, toDate);
			});

			template.find('.filter-div .refresh-filter').on('click', function(e) {
				self.callLogsRenderContent(template.parents('.right-content'));
			});

			template.find('.filter-div .download-csv').on('click', function(e) {
				monster.ui.alert('Not implemented yet!');
			});

			template.find('.search-div input.search-query').on('keyup', function(e) {
				if(template.find('.grid-row-container .grid-row').length > 0) {
					var searchValue = $(this).val().replace(/\|/g,'').toLowerCase(),
						matchedResults = false;
					if(searchValue.length <= 0) {
						template.find('.grid-row-group').show();
						matchedResults = true;
					} else {
						_.each(cdrs, function(cdr) {
							var callIds = (cdr.callId || cdr.id) + (cdr.bLegs.length>0 ? "|" + $.map(cdr.bLegs, function(val) { return val.callId || val.id }).join("|") : ""),
								searchString = (cdr.date + "|" + cdr.fromName + "|"
											 + cdr.fromNumber + "|" + cdr.toName + "|"
											 + cdr.toNumber + "|" + cdr.hangupCause + "|"
											 + callIds).toLowerCase(),
								rowGroup = template.find('.grid-row.a-leg[data-id="'+cdr.id+'"]').parents('.grid-row-group');
							if(searchString.indexOf(searchValue) >= 0) {
								matchedResults = true;
								rowGroup.show();
							} else {
								var matched = _.find(cdr.bLegs, function(bLeg) {
									var searchStr = (bLeg.date + "|" + bLeg.fromName + "|"
												  + bLeg.fromNumber + "|" + bLeg.toName + "|"
												  + bLeg.toNumber + "|" + bLeg.hangupCause).toLowerCase();
									return searchStr.indexOf(searchValue) >= 0;
								});
								if(matched) {
									matchedResults = true;
									rowGroup.show();
								} else {
									rowGroup.hide();
								}
							}
						})
					}

					if(matchedResults) {
						template.find('.grid-row.no-match').hide();
					} else {
						template.find('.grid-row.no-match').show();
					}
				}
			});

			template.on('click', '.a-leg.has-b-legs', function(e) {
				var rowGroup = $(this).parents('.grid-row-group');
				if(rowGroup.hasClass('open')) {
					rowGroup.removeClass('open');
					rowGroup.find('.b-leg').slideUp();
				} else {
					template.find('.grid-row-group').removeClass('open');
					template.find('.b-leg').slideUp();
					rowGroup.addClass('open');
					rowGroup.find('.b-leg').slideDown();
				}
			});

			template.on('click', '.grid-cell.details i', function(e) {
				e.stopPropagation();
				var cdrId = $(this).parents('.grid-row').data('id');
				self.callLogsShowDetailsPopup(cdrId);
			});

			template.on('click', '.grid-cell.report a', function(e) {
				e.stopPropagation();
			});

			function loadMoreCdrs() {
				var loaderDiv = template.find('.call-logs-loader');
				if(startKey) {
					loaderDiv.toggleClass('loading');
					loaderDiv.find('.loading-message > i').toggleClass('icon-spin');
					self.callLogsGetCdrs(fromDate, toDate, function(newCdrs, nextStartKey) {
						newCdrs = self.callLogsFormatCdrs(newCdrs);
						cdrsTemplate = $(monster.template(self, 'callLogs-cdrsList', {cdrs: newCdrs}));

						startKey = nextStartKey;
						if(!startKey) {
							template.find('.call-logs-loader').hide();
						}

						template.find('.call-logs-grid .grid-row-container').append(cdrsTemplate);

						cdrs = cdrs.concat(newCdrs);
						var searchInput = template.find('.search-div input.search-query');
						if(searchInput.val()) {
							searchInput.keyup();
						}

						loaderDiv.toggleClass('loading');
						loaderDiv.find('.loading-message > i').toggleClass('icon-spin');

					}, startKey);
				} else {
					loaderDiv.hide();
				}
			}

			template.find('.call-logs-grid').on('scroll', function(e) {
				var $this = $(this);
				if($this.scrollTop() === $this[0].scrollHeight - $this.innerHeight()) {
					loadMoreCdrs();	
				}
			});

			template.find('.call-logs-loader:not(.loading) .loader-message').on('click', function(e) {
				loadMoreCdrs();
			});
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

			if(pageStartKey) {
				filters['start_key'] = pageStartKey;
			}

			self.callApi({
				resource: 'cdrs.list',
				data: {
					accountId: self.accountId,
					filters: filters
				},
				success: function(data, status) {
					var cdrs = {},
						groupedLegs = _.groupBy(data.data, function(val) { return val.direction === 'inbound' ? 'aLegs' : 'bLegs' });

					if(self.lastALeg) {
						groupedLegs.aLegs.splice(0, 0, self.lastALeg);
					}
					// if(self.loneBLegs && self.loneBLegs.length) {
					// 	groupedLegs.bLegs = self.loneBLegs.concat(groupedLegs.bLegs);
					// }
					if(data['next_start_key']) {
						self.lastALeg = groupedLegs.aLegs.pop();
					}

					_.each(groupedLegs.aLegs, function(val) {
						var call_id = val.call_id || val.id;
						cdrs[call_id] = { aLeg: val, bLegs: {} };
					});

					if(self.loneBLegs && self.loneBLegs.length > 0) {
						_.each(self.loneBLegs, function(val) {
							if('other_leg_call_id' in val && val.other_leg_call_id in cdrs) {
								cdrs[val.other_leg_call_id].bLegs[val.id] = val;
							}
						});
					}
					self.loneBLegs = [];
					_.each(groupedLegs.bLegs, function(val) {
						if('other_leg_call_id' in val) {
							if(val.other_leg_call_id in cdrs) {
								cdrs[val.other_leg_call_id].bLegs[val.id] = val;
							} else {
								self.loneBLegs.push(val);
							}
						}
					});

					callback(cdrs, data['next_start_key']);
				}
			});
		},

		callLogsFormatCdrs: function(cdrs) {
			var self = this,
				result = [],
				formatCdr = function(cdr) {
					var date = monster.util.gregorianToDate(cdr.timestamp),
						day = (date.getDate() < 10 ? "0" : "") + date.getDate(),
						month = (date.getMonth() < 9 ? "0" : "") + (date.getMonth()+1),
						year = date.getFullYear().toString().substr(2),
						hours = (date.getHours() < 10 ? "0" : "") + date.getHours(),
						minutes = (date.getMinutes() < 10 ? "0" : "") + date.getMinutes(),
						durationMin = parseInt(cdr.duration_seconds/60).toString(),
						durationSec = (cdr.duration_seconds % 60 < 10 ? "0" : "") + (cdr.duration_seconds % 60);

					return {
						id: cdr.id,
						callId: cdr.call_id,
						timestamp: cdr.timestamp,
						date: month+"/"+day+"/"+year,
						time: hours+":"+minutes,
						fromName: cdr.caller_id_name,
						fromNumber: cdr.caller_id_number || cdr.from.replace(/@.*/, ''),
						toName: cdr.callee_id_name,
						toNumber: cdr.callee_id_number || ("request" in cdr) ? cdr.request.replace(/@.*/, '') : cdr.to.replace(/@.*/, ''),
						duration: durationMin + ":" + durationSec,
						hangupCause: cdr.hangup_cause,
						isOutboundCall: ("authorizing_id" in cdr),
						mailtoLink: "mailto:support@2600hz.com"
								  + "?subject=Call Report: " + cdr.call_id
								  + "&body=Please describe the details of the issue:%0D%0A%0D%0A"
								  + "%0D%0A____________________________________________________________%0D%0A"
								  + "%0D%0AAccount ID: " + self.accountId
								  + "%0D%0AFrom (Name): " + (cdr.caller_id_name || "")
								  + "%0D%0AFrom (Number): " + (cdr.caller_id_number || cdr.from.replace(/@.*/, ''))
								  + "%0D%0ATo (Name): " + (cdr.callee_id_name || "")
								  + "%0D%0ATo (Number): " + (cdr.callee_id_number || ("request" in cdr) ? cdr.request.replace(/@.*/, '') : cdr.to.replace(/@.*/, ''))
								  + "%0D%0ADate: " + month+"/"+day+"/"+year
								  + "%0D%0ADuration: " + durationMin + ":" + durationSec
								  + "%0D%0AHangup Cause: " + (cdr.hangup_cause || "")
								  + "%0D%0ACall ID: " + cdr.call_id
								  + "%0D%0AOther Leg Call ID: " + (cdr.other_leg_call_id || "")
								  + "%0D%0AHandling Server: " + (cdr.handling_server || "")
					};
				};

			_.each(cdrs, function(val, key) {
				if(!('aLeg' in val)) {
					// Handling lone b-legs as standalone a-legs
					_.each(val.bLegs, function(v, k) {
						result.push($.extend({ bLegs: [] }, formatCdr(v)));
					});
				} else {
					var cdr = formatCdr(val.aLeg);
					cdr.bLegs = [];
					_.each(val.bLegs, function(v, k) {
						cdr.bLegs.push(formatCdr(v));
					});
					result.push(cdr);
				}
			});

			result.sort(function(a, b) {
				return b.timestamp - a.timestamp;
			})

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
					function objToArray(obj, prefix) {
						var prefix = prefix || "",
							result = [];
						_.each(obj, function(val, key) {
							if(typeof val === "object") {
								result = result.concat(objToArray(val, prefix+key+"."));
							} else {
								result.push({
									key: prefix+key,
									value: val
								});
							}
						});
						return result;
					}

					var detailsArray = objToArray(data.data);
					detailsArray.sort(function(a, b) {
						return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
					})

					monster.ui.dialog(
						monster.template(self, 'callLogs-detailsPopup', { details: detailsArray }),
						{ title: self.i18n.active().callLogs.detailsPopupTitle }
					);
				},
				error: function(data, status) {
					monster.ui.alert('error', self.i18n.active().callLogs.alertMessages.getDetailsError);
				}
			});
		}
	};

	return app;
});
