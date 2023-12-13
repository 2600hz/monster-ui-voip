define(function(require) {
	var _ = require('lodash');
	var monster = require('monster');

	return {
		usersCallForwardingRender: function(user) {
			var self = this,
				getData = _.bind(self.usersCallForwardingGetData, self),
				bindEvents = _.bind(self.usersCallForwardingBindingEvents, self),
				initTemplate = function(data) {
					var isCallForwardVmEnabled = _.get(user, 'smartpbx.call_forwarding.enabled', false),
						isCallForwardEnabled = _.has(user, 'call_forward'),
						isUnconditionalVmEnabled = !isCallForwardEnabled && _.has(user, 'smartpbx.call_forwarding.unconditional') && isCallForwardVmEnabled,
						isBusyVmEnabled = !isCallForwardEnabled && _.has(user, 'smartpbx.call_forwarding.busy') && isCallForwardVmEnabled,
						isNoAnswerVmEnabled = !isCallForwardEnabled && _.has(user, 'smartpbx.call_forwarding.no_answer') && isCallForwardVmEnabled,
						isBusyEnabled = _.get(user, 'call_forward.busy.enabled', false),
						isNoAnswerEnabled = _.get(user, 'call_forward.no_answer.enabled', false),
						layoutTemplate = $(self.getTemplate({
							name: 'layout',
							data: {
								data: data,
								enabled: isCallForwardEnabled || isCallForwardVmEnabled,
								isUnconditionalEnabled: _.get(user, 'call_forward.unconditional.enabled', (isBusyEnabled || isNoAnswerEnabled)
									? false
									: _.get(user, 'call_forward.enabled', false)) || isUnconditionalVmEnabled,
								isBusyEnabled: isBusyEnabled || isBusyVmEnabled,
								isNoAnswerEnabled: isNoAnswerEnabled || isNoAnswerVmEnabled
							},
							submodule: 'usersCallForwarding'
						}));

					layoutTemplate.find('.feature-popup-title').each(function() {
						var strategy = $(this).data('template'),
							hasVmBox = _.get(user, 'smartpbx.call_forwarding.enabled') && !_.has(user, 'call_forward');

						function isAnyStrategySpecificSettingAvailable(property) {
							var strategies = Object.keys(_.get(user, 'call_forward', {}));
							return strategies.some(function(str) {
								return str !== 'enabled' && _.get(user, ['call_forward', str, property]) !== undefined;
							});
						}

						function findAnyStrategySpecificSetting(property) {
							var strategies = Object.keys(_.get(user, 'call_forward', {}));
							for (var i = 0; i < strategies.length; i++) {
								var str = strategies[i];
								if (str !== 'enabled' && _.get(user, ['call_forward', str, property]) !== undefined) {
									return _.get(user, ['call_forward', str, property]);
								}
							}
							return undefined;
						}

						function getCallForwardSetting(property, defaultValue) {
							var anyStrategySpecificAvailable = isAnyStrategySpecificSettingAvailable(property);
							var generalSetting = _.get(user, ['call_forward', property], defaultValue);

							if (anyStrategySpecificAvailable) {
								return findAnyStrategySpecificSetting(property);
							} else {
								return generalSetting;
							}
						}

						var isKeepCallerIdEnabled = getCallForwardSetting('keep_caller_id', false);
						var isDirectCallsOnlyEnabled = getCallForwardSetting('direct_calls_only', false);
						var isRequireKeypressEnabled = getCallForwardSetting('require_keypress', false);
						var isIgnoreEarlyMediaEnabled = getCallForwardSetting('ignore_early_media', false);

						if (strategy !== 'off') {
							var simpleStrategyTemplate = $(self.getTemplate({
								name: 'simpleStrategy',
								data: {
									strategy: strategy,
									enabled: isCallForwardVmEnabled || isCallForwardEnabled,
									number: _.get(user, ['call_forward', strategy, 'number'], _.get(user, ['call_forward', 'number'], '')),
									keep_caller_id: isKeepCallerIdEnabled,
									direct_calls_only: isDirectCallsOnlyEnabled,
									require_keypress: isRequireKeypressEnabled,
									ignore_early_media: isIgnoreEarlyMediaEnabled,
									type: hasVmBox ? 'voicemail' : isCallForwardEnabled ? 'phoneNumber' : 'voicemail',
									voicemails: data.voicemails,
									selectedVoicemailId: _.get(user, ['smartpbx', 'call_forwarding', strategy, 'voicemail'], data.voicemails[0]),
									user: user
								},
								submodule: 'usersCallForwarding'
							}));
							$(this).find('.simple-strategy').append(simpleStrategyTemplate);
						}
					});

					return layoutTemplate;
				};

			monster.waterfall([
				getData,
				function(voicemails, callback) {
					voicemails || callback(new Error('No voicemails received'));

					var userVoicemails = _.filter(voicemails, function(vmbox) {
						return vmbox.owner_id === user.id;
					});
					callback(null, userVoicemails);
				},
				function(userVoicemails, callback) {
					var data = {
						voicemails: userVoicemails,
						user: user
					};
					try {
						var $template = initTemplate(data);
						bindEvents($template, data);
						monster.ui.dialog($template, {
							title: user.extra.mapFeatures.call_forwarding.title,
							position: ['center', 20]
						});
						callback(null);
					} catch (e) {
						callback(e);
					}
				}
			], function(err) {
				err && console.error('Error in processing:', err);
			});
		},

		usersCallForwardingGetData: function(callback) {
			var self = this;

			self.callApi({
				resource: 'voicemail.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: 'false'
					}
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
				var $button = $(this);

				monster.waterfall([
					function(waterfallCallback) {
						var updateData = self.usersCallForwardingGetFormData(data),
							cleanedData = self.usersCleanUserData(updateData);

						waterfallCallback(null, cleanedData);
					},
					function(cleanedData, waterfallCallback) {
						self.usersCallForwardingSaveData(cleanedData, function(err) {
							if (err) {
								return monster.ui.toast({
									type: 'warning',
									message: self.i18n.active().users.callForwarding.toast.error.save
								});
							}
							getPopup($button).dialog('close');

							self.usersRender({
								userId: data.user.id,
								openedTab: 'features'
							});
						});
						waterfallCallback(true);
					}
				]);
			});

			$template.find('.cancel-link').on('click', function() {
				getPopup($(this)).dialog('close');
			});

			$template.find('.switch-state').on('change', function() {
				var self = this,
					strategy = self.parentElement.parentElement.parentElement.attributes['data-template']
						? self.parentElement.parentElement.parentElement.attributes['data-template'].value
						: self.parentElement.parentElement.parentElement.parentElement.attributes['data-template'].value,
					dataStrategyString = 'data-strategy="' + strategy + '"',
					simpleStrategyContainers = $template.find('.simple-strategy');

				_.forEach(simpleStrategyContainers, function(div) {
					if (div.outerHTML.includes(dataStrategyString) && !_.has(data.user, ['call_forward', strategy])) {
						$template.find(div).removeClass('disabled');
						$(div).find('.options').addClass('disabled');
						$(div).find('.simple-control-group.phone-number').addClass('disabled');
						$(div).find('.simple-control-group.voicemail').removeClass('disabled');
						$(div).closest('.simple-strategy').find('input[value="voicemail"]').prop('checked', true);
					} else if (div.outerHTML.includes(dataStrategyString) && _.has(data.user, ['call_forward', strategy])) {
						$template.find(div).removeClass('disabled');
					} else {
						$template.find(div).addClass('disabled');
					};
				});
			});

			$template.on('change', '.radio-state', function() {
				var self = this;

				if (self.checked && self.defaultValue === 'phoneNumber') {
					$(this).closest('.phone-number-wrapper').siblings().find('.simple-control-group.voicemail').addClass('disabled').find('input').prop('checked', true);
					$(this).closest('.phone-number-wrapper').find('.simple-control-group.phone-number').removeClass('disabled').find('input').prop('checked', true);

					$(this).closest('.phone-number-wrapper').siblings('.options').removeClass('disabled');
				}

				if (self.checked && self.defaultValue === 'voicemail') {
					$(this).closest('.voicemail-wrapper').find('.simple-control-group.voicemail').removeClass('disabled').find('input').prop('checked', true);
					$(this).closest('.voicemail-wrapper').siblings().find('.simple-control-group.phone-number').addClass('disabled').find('input').prop('checked', false);
					$(this).closest('.voicemail-wrapper').siblings('.options').addClass('disabled');
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
		},

		usersCallForwardingGetFormData: function(data) {
			var self = this,
				user = data.user,
				formData = monster.ui.getFormData('call_forward_form'),
				callForwardStrategy = formData.call_forwarding_strategy,
				isStategyBusy = callForwardStrategy === 'busy',
				isStrategyOff = callForwardStrategy === 'off',
				isStategyNoAnswer = callForwardStrategy === 'no_answer',
				callForwardData = formData[callForwardStrategy],
				defaultVoicemail = _.get(user, ['smartpbx', 'call_forwarding', 'default'], data.voicemails[0].id),
				voicemail = isStrategyOff ? defaultVoicemail : _.get(callForwardData, 'voicemail.value', defaultVoicemail),
				isSkipToVoicemailEnabled = isStrategyOff || isStategyBusy || isStategyNoAnswer || callForwardData.type === 'phoneNumber' ? false : true;

			monster.waterfall([
				function(waterfallCallback) {
					var standardFlow = self.buildStandardFlow(user, voicemail);
					_.set(standardFlow, 'data.skip_module', isSkipToVoicemailEnabled);
					self.resetUserCallFlow(user, standardFlow);
					waterfallCallback(true);
				}
			]);

			if (callForwardData && callForwardData.type === 'phoneNumber') {
				_.set(user, 'call_forward', {
					[callForwardStrategy]: {
						enabled: true,
						number: _.get(callForwardData, 'phoneNumber', ''),
						keep_caller_id: _.includes(callForwardData.isEnabled, 'keep'),
						direct_calls_only: _.includes(callForwardData.isEnabled, 'forward'),
						require_keypress: _.includes(callForwardData.isEnabled, 'acknowledge'),
						ignore_early_media: _.includes(callForwardData.isEnabled, 'ring')
					},
					enabled: true
				});

				_.set(user, 'smartpbx.call_forwarding', {
					enabled: true
				});
			}

			if ((callForwardData && callForwardData.type === 'voicemail') || isStrategyOff) {
				var fullName = user.first_name + ' ' + user.last_name,
					matchingVoicemail = data.voicemails.find(function(voicemail) {
						return voicemail.name === fullName + '\'s VMBox';
					}),
					matchingVoicemailId = matchingVoicemail ? matchingVoicemail.id : data.voicemails[0].id;

				_.set(user, 'smartpbx.call_forwarding', {
					enabled: callForwardStrategy !== 'off',
					[callForwardStrategy]: {
						voicemail: voicemail
					},
					'default': matchingVoicemailId
				});

				if (isStrategyOff) {
					_.set(user, 'call_forward', {
						enabled: false
					});
				};

				delete user.call_forward;
			}

			return user;
		},

		usersCallForwardingSaveData: function(userData, callback) {
			var self = this;

			self.callApi({
				resource: 'user.update',
				data: {
					accountId: self.accountId,
					userId: userData.id,
					data: userData
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

		usersCleanUserData: function(userData) {
			var self = this,
				userData = $.extend(true, {}, userData),
				fullName = monster.util.getUserFullName(userData),
				defaultCallerIdName = fullName.substring(0, 15),
				newCallerIDs = {
					caller_id: {
						internal: {
							name: defaultCallerIdName
						}
					}
				};

			userData = $.extend(true, userData, newCallerIDs);
			/* If the user has been removed from the directory */
			if (userData.extra) {
				if (userData.extra.includeInDirectory === false) {
					if ('directories' in userData && userData.extra.mainDirectoryId && userData.extra.mainDirectoryId in userData.directories) {
						delete userData.directories[userData.extra.mainDirectoryId];
					}
				} else {
					userData.directories = userData.directories || {};

					if (userData.extra.mainCallflowId) {
						userData.directories[userData.extra.mainDirectoryId] = userData.extra.mainCallflowId;
					}
				}

				if ('differentEmail' in userData.extra && userData.extra.differentEmail) {
					if ('email' in userData.extra) {
						userData.email = userData.extra.email;
					}
				} else {
					userData.email = userData.username;
				}

				if ('language' in userData.extra) {
					if (userData.extra.language !== 'auto') {
						userData.language = userData.extra.language;
					} else {
						delete userData.language;
					}
				}

				/**
				 * When updating the user type, override existing one with new
				 * user type selected.
				 * Once set the `service` prop should not be removed by the UI.
				 *
				 */
				if (userData.extra.hasOwnProperty('licensedRole')) {
					userData.service = {
						plans: {}
					};
					userData.service.plans[userData.extra.licensedRole] = {
						account_id: monster.config.resellerId,
						overrides: {}
					};
				}
			}

			// if presence_id doesn't have a proper value, delete it and remove the internal callerId
			if (!userData.hasOwnProperty('presence_id') || userData.presence_id === 'unset' || !userData.presence_id) {
				delete userData.presence_id;

				if (userData.caller_id.hasOwnProperty('internal')) {
					delete userData.caller_id.internal.number;
				}
			} else {
				// Always set the Internal Caller-ID Number to the Main Extension/Presence ID
				userData.caller_id.internal.number = userData.presence_id + '';
			}

			if (userData.hasOwnProperty('caller_id_options') && userData.caller_id_options.hasOwnProperty('outbound_privacy') && userData.caller_id_options.outbound_privacy === 'default') {
				delete userData.caller_id_options.outbound_privacy;

				if (_.isEmpty(userData.caller_id_options)) {
					delete userData.caller_id_options;
				}
			}

			if (userData.timezone === 'inherit') {
				delete userData.timezone;
			}

			_.set(userData, 'ui_help.myaccount.showfirstUseWalkthrough', false);
			_.set(userData, 'ui_help.voip.showDashboardWalkthrough', false);
			_.set(userData, 'ui_help.voip.showUsersWalkthrough', false);

			delete userData.include_directory;
			delete userData.features;
			delete userData.extra;
			delete userData[''];
			delete userData.confirm_password;

			return userData;
		},

		resetUserCallFlow: function(user, flow) {
			var self = this,
				userId = user.id,
				callback = user.callback;

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
					var isFlowsEqual = _.isEqual(callflow.flow, flow);
					if (!isFlowsEqual) {
						_.set(callflow, 'flow', flow);
						self.callApi({
							resource: 'callflow.update',
							data: {
								accountId: self.accountId,
								callflowId: callflow.id,
								data: callflow
							},
							success: function(callflowData) {
								callback && callback(callflowData.data);
							}
						});
					}
					waterfallCallback(true);
				}
			], callback);
		},

		buildStandardFlow: function(user, voicemailId) {
			var flow = {
				module: 'user',
				data: {
					id: user.id,
					timeout: 20,
					can_call_self: false,
					delay: 0,
					strategy: 'simultaneous',
					skip_module: true
				},
				children: {
					_: {
						module: 'voicemail',
						data: {
							id: voicemailId,
							action: 'compose',
							callerid_match_login: false,
							interdigit_timeout: 2000,
							max_message_length: 500,
							single_mailbox_login: false
						},
						children: {}
					}
				}
			};

			return flow;
		}
	};
});
