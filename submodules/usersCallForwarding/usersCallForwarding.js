define(function(require) {
	var _ = require('lodash');
	var monster = require('monster');

	return {
		usersCallForwardingRender: function(user) {
			var self = this,
				meta = self.appFlags.strategyHours.intervals,
				timepickerStep = meta.timepicker.step,
				intervalLowerBound = meta.min,
				intervalUpperBound = meta.max,
				intervals = [
					{
						weekday: 'monday',
						start: 0,
						end: 84600,
						active: true
					},
					{
						weekday: 'tuesday',
						start: 0,
						end: 84600,
						active: true
					},
					{
						weekday: 'wednesday',
						start: 0,
						end: 84600,
						active: true
					},
					{
						weekday: 'thursday',
						start: 0,
						end: 84600,
						active: true
					},
					{
						weekday: 'friday',
						start: 0,
						end: 84600,
						active: true
					},
					{
						weekday: 'saturday',
						start: 0,
						end: 84600,
						active: true
					},
					{
						weekday: 'sunday',
						start: 0,
						end: 84600,
						active: true
					}
				],
				getData = _.bind(self.usersCallForwardingGetData, self),
				formatData = _.bind(self.usersCallForwardingFormatData, self),
				bindEvents = _.bind(self.usersCallForwardingBindingEvents, self),
				initTemplate = function(data) {
					var isCallForwardVmEnabled = _.get(user, 'call_forward_vm.unconditional.enabled', false)
												|| _.get(user, 'call_forward_vm.busy.enabled', false)
												|| _.get(user, 'call_forward_vm.no_answer.enabled', false)
												|| _.get(user, 'call_forward_vm.selective.enabled', false),
						isCallForwardEnabled = _.get(user, 'call_forward.unconditional.enabled', false)
												|| _.get(user, 'call_forward.busy.enabled', false)
												|| _.get(user, 'call_forward.no_answer.enabled', false)
												|| _.get(user, 'call_forward.selective.enabled', false),
						layoutTemplate = $(self.getTemplate({
							name: 'layout',
							data: {
								data: formatData(data),
								enabled: isCallForwardEnabled || isCallForwardVmEnabled,
								isUnconditionalEnabled: _.get(user, 'call_forward.unconditional.enabled', false) || _.get(user, 'call_forward_vm.unconditional.enabled', false),
								isBusyEnabled: _.get(user, 'call_forward.busy.enabled', false) || _.get(user, 'call_forward_vm.busy.enabled', false),
								isNoAnswerEnabled: _.get(user, 'call_forward.no_answer.enabled', false) || _.get(user, 'call_forward_vm.no_answer.enabled', false),
								isSelectiveEnabled: _.get(user, 'call_forward.selective.enabled', false) || _.get(user, 'call_forward_vm.selective.enabled', false)
							},
							submodule: 'usersCallForwarding'
						}));

					layoutTemplate.find('.feature-popup-title').each(function() {
						var strategy = $(this).data('template'),
							hasVmBox = _.has(user, 'call_forward_vm'),
							isKeepCallerIdEnabled = _.get(user, ['call_forward', strategy, 'keep_caller_id'], false),
							isDirectCallsOnlyEnabled = _.get(user, ['call_forward', strategy, 'direct_calls_only'], false) || _.get(user, ['call_forward_vm', strategy, 'direct_calls_only'], false),
							isRequireKeypressEnabled = _.get(user, ['call_forward', strategy, 'require_keypress'], false),
							isIgnoreEarlyMediaEnabled = _.get(user, ['call_forward', strategy, 'ignore_early_media'], false);

						if (strategy !== 'off' || strategy !== 'selective') {
							var simpleStrategyTemplate = $(self.getTemplate({
								name: 'simpleStrategy',
								data: {
									strategy: strategy,
									enabled: isCallForwardVmEnabled || isCallForwardEnabled,
									number: _.get(user, ['call_forward', strategy, 'number'], ''),
									keep_caller_id: isKeepCallerIdEnabled,
									direct_calls_only: isDirectCallsOnlyEnabled,
									require_keypress: isRequireKeypressEnabled,
									ignore_early_media: isIgnoreEarlyMediaEnabled,
									type: hasVmBox ? 'voicemail' : 'phoneNumber',
									voicemails: data.voicemails,
									selectedVoicemailId: _.get(user, ['call_forward_vm', strategy, 'voicemail'], data.voicemails[0]),
									user: user
								},
								submodule: 'usersCallForwarding'
							}));
							$(this).find('.simple-strategy').append(simpleStrategyTemplate);
						}

						if (strategy === 'selective') {
							var complexStrategyTemplate = $(self.getTemplate({
									name: 'complexStrategy',
									data: {
										strategy: strategy,
										enabled: isCallForwardVmEnabled || isCallForwardEnabled,
										number: _.get(user, ['call_forward', strategy, 'number'], ''),
										keep_caller_id: isKeepCallerIdEnabled,
										direct_calls_only: isDirectCallsOnlyEnabled,
										require_keypress: isRequireKeypressEnabled,
										ignore_early_media: isIgnoreEarlyMediaEnabled,
										type: hasVmBox ? 'voicemail' : 'phoneNumber',
										voicemails: data.voicemails,
										selectedVoicemailId: _.get(user, ['call_forward_vm', strategy, 'voicemail'], data.voicemails[0]),
										user: user
									},
									submodule: 'usersCallForwarding'
								})),
								listingTemplate = $(self.getTemplate({
									name: 'listing',
									data: {
										strategy: strategy,
										intervals: intervals
									},
									submodule: 'usersCallForwarding'
								}));

							_.forEach(intervals, function(interval, index) {
								var $startPicker = listingTemplate.find('input[name="' + strategy + '.intervals[' + index + '].start"]'),
									$endPicker = listingTemplate.find('input[name="' + strategy + '.intervals[' + index + '].end"]'),
									endTime = interval.end,
									endRemainder = endTime % timepickerStep,
									startPickerMaxTime = endTime - endRemainder - (endRemainder > 0 ? 0 : timepickerStep),
									startTime = interval.start,
									startRemainder = startTime % timepickerStep,
									endPickerMinTime = startTime - startRemainder + timepickerStep;

								monster.ui.timepicker($startPicker, {
									listWidth: 1,
									minTime: intervalLowerBound,
									maxTime: startPickerMaxTime
								});
								$startPicker.timepicker('setTime', startTime);

								monster.ui.timepicker($endPicker, {
									listWidth: 1,
									minTime: endPickerMinTime,
									maxTime: intervalUpperBound - timepickerStep
								});
								$endPicker.timepicker('setTime', endTime);
							});

							$(this).find('.complex-strategy').append(complexStrategyTemplate);
							$(this).find('.office-hours-wrapper').append(listingTemplate);
						}
					});

					return layoutTemplate;
				};

			monster.waterfall([
				getData
			], function(err, voicemails) {
				var data = {
						voicemails: voicemails,
						user: user
					},
					$template = initTemplate(data);

				bindEvents($template, data);

				monster.ui.dialog($template, {
					title: user.extra.mapFeatures.call_forwarding.title,
					position: ['center', 20]
				});
			});
		},

		usersCallForwardingGetData: function(callback) {
			var self = this;

			self.callApi({
				resource: 'voicemail.list',
				data: {
					accountId: self.accountId
				},
				success: _.flow(
					_.partial(_.get, _, 'data'),
					_.partial(callback, null)
				),
				error: _.partial(callback, _, [])
			});
		},

		usersCallForwardingBindingEvents: function($template, data) {
			var self = this,
				getPopup = function($node) {
					return $node.parents('.ui-dialog-content');
				};

			$template.find('.save').on('click', function() {
				var $button = $(this),
					updateData = self.usersCallForwardingGetFormData(data);

				self.usersCallForwardingSaveData({
					data: updateData,
					userId: data.user.id
				}, function(err) {
					if (err) {
						return monster.ui.toast({
							type: 'warning',
							message: self.i18n.active().users.callForwarding.toast.error.save
						});
					}
					getPopup($button).dialog('close');
				});
			});

			$template.find('.cancel-link').on('click', function() {
				getPopup($(this)).dialog('close');
			});

			$template.find('.switch-state').on('change', function() {
				var self = this,
					strategy = self.parentElement.parentElement.parentElement.attributes['data-template'] ? self.parentElement.parentElement.parentElement.attributes['data-template'].value : self.parentElement.parentElement.parentElement.parentElement.attributes['data-template'].value,
					dataStrategyString = 'data-strategy="' + strategy + '"',
					simpleStrategyContainers = $template.find('.simple-strategy'),
					complexStrategyContainer = $template.find('.complex-strategy');

				simpleStrategyContainers.push(complexStrategyContainer[0]);

				_.forEach(simpleStrategyContainers, function(div) {
					if (div.outerHTML.includes(dataStrategyString)) {
						$template.find(div).removeClass('disabled');
					} else {
						$template.find(div).addClass('disabled');
					}
				});
			});

			$template.find('.radio-state').on('change', function() {
				var self = this,
					strategy = self.name.split('.')[0],
					options = $template.find('.option[strategy=' + strategy + ']');

				if (self.checked && self.defaultValue === 'phoneNumber') {
					_.each(options, function(div) {
						$template.find('.simple-control-group.phone-number').removeClass('disabled').find('input').prop('checked', true);
						$template.find('.simple-control-group.voicemail').addClass('disabled').find('input').prop('checked', false);
						$template.find(div).removeClass('disabled').find('input');
					});
					if (strategy === 'selective') {
						$template.find('.selective-control-group.phone-number').removeClass('disabled');
						$template.find('.selective-control-group.voicemail').addClass('disabled');
					}
				}

				if (self.checked && self.defaultValue === 'voicemail') {
					_.each(options, function(div) {
						if (div.children[0].innerText !== 'Forward direct calls only') {
							$template.find('.simple-control-group.voicemail').removeClass('disabled').find('input').prop('checked', true);
							$template.find('.simple-control-group.phone-number').addClass('disabled').find('input').prop('checked', false);
							$template.find(div).addClass('disabled').find('input');
						}
					});

					if (strategy === 'selective') {
						$template.find('.selective-control-group.phone-number').addClass('disabled');
						$template.find('.selective-control-group.voicemail').removeClass('disabled');
					}
				}

				if (self.checked && self.defaultValue === 'custom') {
					$template.find('.office-hours-wrapper').removeClass('disabled');
				} else if (self.checked && self.defaultValue === 'always') {
					$template.find('.office-hours-wrapper').addClass('disabled');
				}

				if (self.checked) {
					self.defaultValue === 'allNumbers' && $template.find('.selective-control-group.specific').addClass('disabled').find('input').prop('checked', false);
					self.defaultValue === 'specific' && $template.find('.selective-control-group.specific').removeClass('disabled').find('input').prop('checked', true);
				}
			});

			$template.find('.checkbox').each(function() {
				if ($(this).is(':checked')) {
					$(this).closest('.option').addClass('option-checked');
				}

				$(this).on('change', function() {
					if ($(this).is(':checked')) {
						$(this).closest('.option').addClass('option-checked');
					} else {
						$(this).closest('.option').removeClass('option-checked');
					}
				});
			});

			$template.find('.add-phone-number').on('click', function() {
				var count = $template.find('.selective-control-group.specific').find('.controls').length,
					containerToAppend = $template.find('.specific-phone-number-wrapper'),
					numberContainer = $template.find('.specific-phone-number-wrapper')[0].children[1].outerHTML;
				if (count < 10) {
					$(containerToAppend[0]).append(numberContainer);
				}
			});

			$template.on('click', '.remove-number-button', function() {
				var count = $(this).closest('.specific-phone-number-wrapper').find('.controls.specific-controls').length;
				if (count > 1) {
					$(this).closest('.controls.specific-controls').remove();
				}
			});

			$template.on('click', '.add-rule', function() {
				var count = $template.find('.complex-strategy-header').length,
					ruleContainer = $template.find('.complex-strategy-header')[0].outerHTML,
					containerToAppend = $template.find('.test-append');

				if (count < 3) {
					$(containerToAppend[0]).append(ruleContainer);
				}
			});

			$template.on('click', '.remove-rule-button', function() {
				var count = $template.find('.complex-strategy-header').length;

				if (count > 1) {
					$(this).closest('.complex-strategy-header').remove();
				}
			});
		},

		usersCallForwardingGetFormData: function(data) {
			var self = this,
				user = data.user,
				formData = monster.ui.getFormData('call_forward_form'),
				callForwardStrategy = formData.call_forwarding_strategy,
				callForwardData = formData[callForwardStrategy],
				isVmboxEnabled = callForwardStrategy !== 'off' && callForwardData.type === 'voicemail',
				strategies = ['unconditional', 'busy', 'no_answer', 'selective'],
				payload = callForwardStrategy === 'off' ? {
					call_forward: {
						enabled: false
					},
					call_forward_vm: null
				} : callForwardData.type === 'phoneNumber' ? {
					call_forward: {
						enabled: true,
						[callForwardStrategy]: {
							enabled: true,
							keep_caller_id: _.includes(callForwardData.isEnabled, 'keep'),
							direct_calls_only: _.includes(callForwardData.isEnabled, 'forward'),
							require_keypress: _.includes(callForwardData.isEnabled, 'acknowledge'),
							ignore_early_media: _.includes(callForwardData.isEnabled, 'ring'),
							substitute: false,
							number: _.get(callForwardData, 'phoneNumber', '')
						}
					},
					call_forward_vm: null
				} : {
					call_forward_vm: {
						[callForwardStrategy]: {
							enabled: callForwardStrategy !== 'off' && callForwardData.type === 'voicemail',
							voicemail: _.get(callForwardData, 'voicemail.value', ''),
							direct_calls_only: true
						}
					},
					call_forward: null
				};

			if (callForwardStrategy === 'selective' && callForwardData.type === 'phoneNumber') {
				_.merge(payload, {
					call_forward: {
						selective: {
							enabled: true,
							number: callForwardData.phoneNumber,
							rules: [
								{
									enabled: true,
									match_list_id: '',
									direct_calls_only: _.includes(callForwardData.isEnabled, 'forward'),
									ignore_early_media: _.includes(callForwardData.isEnabled, 'ring'),
									keep_caller_id: _.includes(callForwardData.isEnabled, 'keep'),
									require_keypress: _.includes(callForwardData.isEnabled, 'acknowledge')
								}
							]
						}
					}
				});
			}

			_.each(strategies, function(strategy) {
				if (strategy !== callForwardStrategy) {
					_.assign(payload.call_forward, {
						[strategy]: null
					});
					_.assign(payload.call_forward_vm, {
						[strategy]: null
					});
				}
			});

			// formattedCallForwardData = self.usersCallForwardingFormatData(data);
			if (callForwardStrategy !== 'off') {
				self.userUpdateCallflow(user, callForwardData.type);
			}

			return payload;
		},

		usersCallForwardingFormatData: function(data) {
			var self = this,
				user = data.user,
				isCallForwardConfigured = _.has(user, 'call_forward.enabled'),
				isCallForwardEnabled = _.get(user, 'call_forward.enabled', false),
				isFailoverEnabled = _.get(user, 'call_failover.enabled', false);

			// cfmode is off if call_forward.enabled = false && call_failover.enabled = false
			// cfmode is failover if call_failover.enabled = true
			// cfmode is on if call_failover.enabled = false && call_forward.enabled = true
			var callForwardMode = 'off';
			if (isFailoverEnabled) {
				callForwardMode = 'failover';
			} else if (isCallForwardEnabled) {
				callForwardMode = 'on';
			}

			return _.merge({}, user, _.merge({
				extra: {
					callForwardMode: callForwardMode
				}
			}, isCallForwardConfigured && {
				call_forward: _.merge({}, _.has(user, 'call_forward.number') && {
					number: monster.util.unformatPhoneNumber(user.call_forward.number)
				})
			}
			));
		},

		usersCallForwardingSaveData: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'user.patch',
				data: {
					accountId: self.accountId,
					userId: data.userId,
					data: data.data
				},
				success: _.partial(callback, null),
				error: _.partial(callback, _)
			});
		},

		getCallflowList: function(userId, callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.list',
				data: {
					accountId: self.accountId,
					filters: {
						filter_owner_id: userId
					}
				},
				success: function(callflowData) {
					callback && callback(callflowData.data);
				}
			});
		},

		skipToVoicemail: function(callflowId, enabled, callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.patch',
				data: {
					accountId: self.accountId,
					callflowId: callflowId,
					data: {
						flow: {
							data: {
								skip_module: enabled
							}
						}
					}
				},
				success: function(callflowData) {
					callback && callback(callflowData.data);
				}
			});
		},

		getCallflow: function(callflowId, callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.get',
				data: {
					accountId: self.accountId,
					callflowId: callflowId
				},
				success: function(callflowData) {
					callback && callback(callflowData.data);
				}
			});
		},

		userUpdateCallflow: function(data, selectedType) {
			var self = this,
				userId = data.id,
				callback = data.callback;

			monster.waterfall([
				function(waterfallCallback) {
					self.getCallflowList(userId, function(callflowList) {
						waterfallCallback(null, callflowList[0].id);
					});
				},
				function(callflowId, waterfallCallback) {
					self.getCallflow(callflowId, function(callflow) {
						waterfallCallback(null, callflow);
					});
				},
				function(callflow, waterfallCallback) {
					var id = callflow.id,
						flow = callflow.flow.data.skip_module,
						enabled = selectedType === 'voicemail';

					if (enabled !== flow) {
						// Skip to voicemail if voicemail is selected
						self.skipToVoicemail(id, enabled);
					} else {
						// Module does not exist in callflow, but should, so err
						waterfallCallback(true);
					}
				}
			], callback);
		}
	};
});
