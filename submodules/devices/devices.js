define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster');

	var app = {

		requests: {
			'provisioner.ui.getModel': {
				'apiRoot': monster.config.api.provisioner,
				'url': 'ui/{brand}/{family}/{model}',
				'verb': 'GET',
				generateError: false
			},
			'provisioner.devices.unlock': {
				'apiRoot': monster.config.api.provisioner,
				'url': 'locks/{accountId}/{macAddress}',
				'verb': 'DELETE'
			}
		},

		subscribe: {
			'voip.devices.render': 'devicesRender',
			'voip.devices.renderAdd': 'devicesRenderAdd',
			'voip.devices.editDevice': 'devicesRenderEdit'
		},

		appFlags: {
			devices: {
				iconClassesByDeviceTypes: {
					application: 'icon-telicon-apps',
					ata: 'icon-telicon-ata',
					cellphone: 'fa fa-phone',
					fax: 'icon-telicon-fax',
					landline: 'icon-telicon-home',
					mobile: 'icon-telicon-sprint-phone',
					sip_device: 'icon-telicon-voip-phone',
					sip_uri: 'icon-telicon-voip-phone',
					smartphone: 'icon-telicon-mobile-phone',
					softphone: 'icon-telicon-soft-phone'
				},
				/**
				 * Lists device types allowed to be added by devicesRenderAdd.
				 * The order is important and controls the list rendered in DOM.
				 * @type {Array}
				 */
				addableDeviceTypes: [
					'sip_device',
					'cellphone',
					'smartphone',
					'softphone',
					'landline',
					'fax',
					'ata',
					'sip_uri'
				],
				/**
				 * Lists device types allowed to be edited by devicesRenderEdit.
				 * @type {Array}
				 */
				editableDeviceTypes: [
					'ata',
					'cellphone',
					'fax',
					'landline',
					'mobile',
					'sip_device',
					'sip_uri',
					'smartphone',
					'softphone'
				]
			}
		},

		/* Users */
		/* args: parent and deviceId */
		devicesRender: function(pArgs) {
			var self = this,
				args = pArgs || {},
				parent = args.parent || $('.right-content'),
				_deviceId = args.deviceId || '',
				callback = args.callback;

			self.devicesGetData(function(data) {
				var dataTemplate = self.devicesFormatListData(data),
					template = $(self.getTemplate({
						name: 'layout',
						data: dataTemplate,
						submodule: 'devices'
					})),
					templateDevice;

				_.each(dataTemplate.devices, function(device) {
					templateDevice = $(self.getTemplate({
						name: 'row',
						data: device,
						submodule: 'devices'
					}));

					template.find('.devices-rows').append(templateDevice);
				});

				self.devicesBindEvents(template, parent, dataTemplate);

				parent
					.empty()
					.append(template);

				if (_deviceId) {
					var row = parent.find('.grid-row[data-id=' + _deviceId + ']');

					monster.ui.highlight(row, {
						endColor: '#FCFCFC'
					});
				}

				if (dataTemplate.devices.length === 0) {
					parent.find('.no-devices-row').css('display', 'block');
				} else {
					parent.find('.no-devices-row').css('display', 'none');
				}

				callback && callback();
			});
		},

		devicesBindEvents: function(template, parent, data) {
			var self = this;

			setTimeout(function() { template.find('.search-query').focus(); });

			template.find('.devices-header .search-query').on('keyup', function() {
				var searchString = $(this).val().toLowerCase(),
					rows = template.find('.devices-rows .grid-row:not(.title)'),
					emptySearch = template.find('.devices-rows .empty-search-row');

				_.each(rows, function(pRow) {
					var row = $(pRow);

					row.data('search').toLowerCase().indexOf(searchString) < 0 ? row.hide() : row.show();
				});

				if (rows.size() > 0) {
					rows.is(':visible') ? emptySearch.hide() : emptySearch.show();
				}
			});

			template.find('.switch-state').on('change', function() {
				var toggle = $(this),
					row = toggle.parents('.grid-row'),
					deviceId = row.data('id'),
					enable = toggle.prop('checked');

				self.devicesGetDevice(deviceId, function(dataDevice) {
					dataDevice.enabled = enable;

					self.devicesUpdateDevice(dataDevice, function(dataDevice) {
						row.find('.type').removeClass('unregistered registered disabled');

						var classStatus = 'disabled';

						if (dataDevice.enabled === true) {
							classStatus = 'unregistered';

							_.each(data.devices, function(device) {
								if (device.id === dataDevice.id) {
									if (device.registered === true) {
										classStatus = 'registered';
									}

									return false;
								}
							});
						}

						row.find('.type').addClass(classStatus);
						//We could display a success message but that could spam the user so for now we don't display anything
					},
					function() {
						toggle.prop('checked', !enable);
					});
				},
				function() {
					toggle.prop('checked', !enable);
				});
			});

			template.find('.settings').on('click', function() {
				var $this = $(this),
					action = $this.data('action'),
					dataDevice = {
						id: $this.parents('.grid-row').data('id'),
						isRegistered: $this.parents('.grid-row').data('registered') === true
					};

				if (action === 'edit') {
					self.devicesRenderEdit({
						data: dataDevice,
						callbackSave: function(dataDevice) {
							self.devicesRender({ deviceId: dataDevice.id });
						}
					});
				} else if (action === 'delete') {
					monster.ui.confirm(self.i18n.active().devices.confirmDeleteDevice, function() {
						self.devicesHelperDeleteDevice(dataDevice.id, function() {
							self.devicesRender();
						});
					});
				}
			});

			template.find('.create-device').on('click', function() {
				var type = $(this).data('type');

				self.devicesRenderAdd({
					type: type,
					callback: function(device) {
						self.devicesRender({ deviceId: device.id });
					}
				});
			});
		},

		/**
		 * @param  {Object} data
		 * @return {Array}
		 */
		getKeyTypes: function(data) {
			return _.filter([
				'combo_keys',
				'feature_keys'
			], function(type) {
				return _.get(data, [type, 'iterate'], 0) > 0;
			});
		},

		/**
		 * @param  {Object} args
		 * @param  {Object} args.data
		 * @param  {Boolean} [args.allowAssign]
		 * @param  {Function} [args.callbackSave]
		 * @param  {Function} [args.callbackDelete]
		 */
		devicesRenderEdit: function(args) {
			var self = this,
				data = args.data,
				allowAssign = _.get(args, 'allowAssign'),
				callbackSave = args.callbackSave,
				callbackDelete = args.callbackDelete || function(device) {
					self.devicesRender();
				};

			self.devicesGetEditData(data, function(dataDevice) {
				self.devicesRenderDevice({
					data: dataDevice,
					allowAssign: allowAssign,
					callbackSave: callbackSave,
					callbackDelete: callbackDelete
				});
			});
		},

		/**
		 * @param  {Object} args
		 * @param  {Boolean} [args.allowAssign]
		 * @param  {String} args.type
		 * @param  {Function} args.callback
		 */
		devicesRenderAdd: function(args) {
			var self = this,
				allowAssign = _.get(args, 'allowAssign'),
				type = args.type,
				callback = args.callback,
				data = {
					device_type: type
				};

			if (type === 'sip_device' && monster.config.api.provisioner) {
				monster.pub('common.chooseModel.render', {
					callback: function(dataModel, callbackCommonSuccess) {
						self.callApi({
							resource: 'device.create',
							data: {
								accountId: self.accountId,
								data: dataModel
							},
							success: function(data, status) {
								callback(data.data);

								callbackCommonSuccess && callbackCommonSuccess();
							}
						});
					},
					callbackMissingBrand: function() {
						self.devicesRenderEdit({
							allowAssign: allowAssign,
							data: data,
							callbackSave: function(dataDevice) {
								callback && callback(dataDevice);
							}
						});
					}
				});
			} else {
				self.devicesRenderEdit({
					allowAssign: allowAssign,
					data: data,
					callbackSave: function(dataDevice) {
						callback && callback(dataDevice);
					}
				});
			}
		},

		/**
		 * @param  {Object} args.data
		 * @param  {Boolean} [args.allowAssign=true]
		 * @param  {Function} [args.callbackSave]
		 * @param  {Function} [args.callbackDelete]
		 */
		devicesRenderDevice: function(args) {
			var self = this,
				data = _.get(args, 'data'),
				isAssignAllowed = !!_.get(args, 'allowAssign', true),
				callbackSave = _.get(args, 'callbackSave'),
				callbackDelete = _.get(args, 'callbackDelete'),
				mode = data.id ? 'edit' : 'add',
				type = data.device_type,
				popupTitle = mode === 'edit'
					? self.getTemplate({
						name: '!' + self.i18n.active().devices[type].editTitle,
						data: {
							name: data.name
						}
					})
					: self.i18n.active().devices[type].addTitle,
				templateDevice = $(self.getTemplate({
					name: 'devices-' + type,
					data: $.extend(true, {}, data, {
						isProvisionerConfigured: monster.config.api.hasOwnProperty('provisioner'),
						showEmergencyCallerId: monster.util.isNumberFeatureEnabled('e911')
					}),
					submodule: 'devices'
				})),
				deviceForm = templateDevice.find('#form_device'),
				assignTemplate = $(self.getTemplate({
					name: 'assign-to',
					data: data,
					submodule: 'devices'
				}));

			if (isAssignAllowed) {
				deviceForm.find('.tabs-section[data-section="basic"]').append(assignTemplate);
			}

			if (data.extra.hasOwnProperty('provision') && data.extra.provision.hasOwnProperty('keys')) {
				_.each(data.extra.provision.keys, function(value) {
					var section = '.tabs-section[data-section="' + value.type + '"] ';

					_.each(value.data, function(val, key) {
						if (val) {
							var groupSelector = '.control-group[data-id="' + key + '"] ',
								valueSelector = '.feature-key-value[data-type~="' + val.type + '"]';

							templateDevice
								.find(section.concat(groupSelector, valueSelector))
								.addClass('active');
							templateDevice.find(valueSelector + ' [name="provision.keys.' + value.id + '[' + key + '].value.value"]')
								.val(_.get(val, 'value.value'));
							templateDevice.find(valueSelector + ' [name="provision.keys.' + value.id + '[' + key + '].value.label"]')
								.val(_.get(val, 'value.label'));
						}
					});
				});

				templateDevice.find('.keys').each(function() {
					var $this = $(this),
						itemUpdated = false,
						$itemUnder,
						$itemBefore,
						$itemAfter,
						$siblings;

					$this.sortable({
						items: '.control-group',
						placeholder: 'control-group placeholder',
						update: function(e, ui) {
							ui.item.addClass('moved');

							itemUpdated = true;
						},
						start: function(e, ui) {
							$itemBefore = ui.item.prevAll('.control-group:not(.placeholder):first');
							$itemAfter = ui.item.nextAll('.control-group:not(.placeholder):first');
							$siblings = ui.item.siblings('.control-group');
						},
						stop: function(e, ui) {
							// Swap
							if (!_.isEmpty($itemUnder) && !$itemUnder.hasClass('placeholder')) {
								$itemUnder.addClass('moved');

								if (itemUpdated) {
									// The dragged item was updated, so we only need to swap the other item
									if (!_.isEmpty($itemBefore) && !$itemUnder.is($itemBefore)) {
										$itemUnder.remove().insertAfter($itemBefore);
									} else if (!_.isEmpty($itemAfter) && !$itemUnder.is($itemAfter)) {
										$itemUnder.remove().insertBefore($itemAfter);
									}
								} else {
									// Special case: the dragged item is over a sibling next to it,
									// but it did not triggered an update event, because the
									// placeholder was still at the same original position of the item
									ui.item.addClass('moved');
									if (!$itemUnder.is($itemBefore)) {
										$itemUnder.insertBefore(ui.item);
									} else if (!$itemUnder.is($itemAfter)) {
										$itemUnder.insertAfter(ui.item);
									}
								}
							}

							// Update items
							$this
								.find('.feature-key-index')
									.each(function(idx, el) {
										$(el).text(idx + 1);
									});

							if ($this.data('section') === 'comboKeys') {
								$this
									.find('.control-group')
										.first()
											.addClass('warning')
										.siblings('.control-group.warning')
											.removeClass('warning');
							}

							// Cleanup
							if (!_.isEmpty($itemUnder)) {
								$itemUnder.removeClass('selected');
								$itemUnder = null;
							}
							itemUpdated = false;
						},
						sort: _.debounce(function(e, ui) {
							var $newItemUnder = $siblings.filter(function(idx, elem) {
								var itemPosition = ui.position,
									$elem = $(elem),
									elemPosition = $elem.position();
								return itemPosition.left >= elemPosition.left
									&& itemPosition.left <= elemPosition.left + $elem.width()
									&& itemPosition.top >= elemPosition.top
									&& itemPosition.top <= elemPosition.top + $elem.height();
							});

							if ($newItemUnder.is($itemUnder)) {
								return;
							}

							if (!_.isEmpty($itemUnder)) {
								$itemUnder.removeClass('selected');
							}

							$newItemUnder.addClass('selected');
							$itemUnder = $newItemUnder;
						}, 50)
					});
				});

				templateDevice
					.find('.feature-key-index')
						.each(function(idx, el) {
							$(el)
								.text(parseInt($(el).text(), 10) + 1);
						});
			}

			if (data.extra.hasE911Numbers) {
				var currentNumber;

				if (data.caller_id && data.caller_id.emergency && data.caller_id.emergency.number) {
					currentNumber = data.caller_id.emergency.number;
					self.devicesGetE911NumberAddress(data.caller_id.emergency.number, function(address) {
						templateDevice
									.find('.number-address')
									.show()
									.find('p')
									.html(address);
					});
				}

				monster.pub('common.numberSelector.render', {
					container: templateDevice.find('.emergency-number'),
					inputName: 'caller_id.emergency.number',
					number: currentNumber,
					customNumbers: data.extra.e911Numbers,
					noBuy: true,
					noExtension: true,
					labels: {
						empty: self.i18n.active().devices.popupSettings.callerId.notSet,
						remove: self.i18n.active().devices.popupSettings.callerId.useDefault,
						spare: self.i18n.active().devices.popupSettings.callerId.selectNumber,
						hideNumber: true
					}
				});
			}

			monster.ui.validate(deviceForm, {
				rules: {
					'name': {
						required: true
					},
					'mac_address': {
						required: true,
						mac: true
					},
					'mobile.mdn': {
						number: true
					},
					'sip.username': {
						required: true
					},
					'sip.password': {
						required: true
					},
					'call_forward.number': {
						required: true
					}
				},
				ignore: '' // Do not ignore hidden fields
			});

			if ($.inArray(type, ['sip_device', 'smartphone', 'mobile', 'softphone', 'fax', 'ata']) > -1) {
				var audioCodecs = monster.ui.codecSelector('audio', templateDevice.find('#audio_codec_selector'), data.media.audio.codecs);
			}

			if ($.inArray(type, ['sip_device', 'smartphone', 'mobile', 'softphone']) > -1) {
				var videoCodecs = monster.ui.codecSelector('video', templateDevice.find('#video_codec_selector'), data.media.video.codecs);
			}

			monster.ui.tabs(templateDevice);
			monster.ui.protectField(templateDevice.find('#sip_password'), templateDevice);

			monster.ui.tooltips(templateDevice);
			monster.ui.mask(templateDevice.find('#mac_address'), 'macAddress');
			monster.ui.mask(templateDevice.find('[name="call_forward.number"]'), 'phoneNumber');
			monster.ui.chosen(templateDevice.find('.chosen-feature-key-user'), {
				width: 'inherit'
			});

			if (!(data.media.encryption.enforce_security)) {
				templateDevice.find('#rtp_method').hide();
			}

			templateDevice.find('#secure_rtp').on('change', function() {
				templateDevice.find('#rtp_method').toggle();
			});

			templateDevice.find('#restart_device').on('click', function() {
				if (!$(this).hasClass('disabled')) {
					self.devicesRestart(data.id, function() {
						monster.ui.toast({
							type: 'success',
							message: self.i18n.active().devices.popupSettings.miscellaneous.restart.success
						});
					});
				}
			});

			templateDevice.find('#unlock_device').on('click', function() {
				self.devicesUnlock(data.mac_address.replace(/:/g, ''), function() {
					monster.ui.toast({
						type: 'success',
						message: self.i18n.active().devices.popupSettings.miscellaneous.unlock.success
					});
				});
			});

			templateDevice.find('.actions .save').on('click', function() {
				if (monster.ui.valid(deviceForm)) {
					templateDevice.find('.feature-key-value:not(.active)').remove();

					var $this = $(this),
						dataToSave = self.devicesMergeData(data, templateDevice, audioCodecs, videoCodecs);

					$this.prop('disabled', 'disabled');

					self.devicesSaveDevice(dataToSave, function(data) {
						popup.dialog('close').remove();

						callbackSave && callbackSave(data);
					}, function() {
						$this.prop('disabled', false);
					});
				} else {
					templateDevice.find('.tabs-selector[data-section="basic"]').click();
				}
			});

			if (type !== 'mobile') {
				templateDevice.find('#delete_device').on('click', function() {
					var deviceId = $(this).parents('.edit-device').data('id');

					self.devicesHelperDeleteDevice(deviceId, function(device) {
						popup.dialog('close').remove();

						callbackDelete && callbackDelete(device);
					});
				});
			}

			templateDevice.find('.actions .cancel-link').on('click', function() {
				popup.dialog('close').remove();
			});

			templateDevice.on('change', '.caller-id-select', function() {
				var selectedNumber = this.value;

				var divAddress = templateDevice.find('.number-address');

				divAddress.find('p').empty();

				if (selectedNumber !== '') {
					self.devicesGetE911NumberAddress(selectedNumber, function(address) {
						divAddress.find('p').html(address);
					});

					divAddress.slideDown();
				} else {
					divAddress.slideUp();
				}
			});

			templateDevice.find('.restrictions-switch').on('change', function() {
				templateDevice.find('.restriction-matcher-sign').hide();
				templateDevice.find('.restriction-message').hide();
			});

			templateDevice.find('.restriction-matcher-button').on('click', function(e) {
				e.preventDefault();
				var number = templateDevice.find('.restriction-matcher-input').val();

				if (number) {
					self.callApi({
						resource: 'numbers.matchClassifier',
						data: {
							accountId: self.accountId,
							phoneNumber: encodeURIComponent(number)
						},
						success: function(data, status) {
							var matchedLine = templateDevice.find('.restriction-line[data-restriction="' + data.data.name + '"]'),
								matchedSign = matchedLine.find('.restriction-matcher-sign'),
								matchedMsg = templateDevice.find('.restriction-message');

							templateDevice.find('.restriction-matcher-sign').hide();
							if (matchedLine.find('.restrictions-switch').prop('checked')) {
								matchedSign
									.removeClass('monster-red fa-times')
									.addClass('monster-green fa-check')
									.css('display', 'inline-block');

								matchedMsg
									.removeClass('red-box')
									.addClass('green-box')
									.css('display', 'inline-block')
									.empty()
									.text(self.getTemplate({
										name: '!' + self.i18n.active().devices.popupSettings.restrictions.matcher.allowMessage,
										data: {
											phoneNumber: monster.util.formatPhoneNumber(number)
										}
									}));
							} else {
								matchedSign
									.removeClass('monster-green fa-check')
									.addClass('monster-red fa-times')
									.css('display', 'inline-block');

								matchedMsg
									.removeClass('green-box')
									.addClass('red-box')
									.css('display', 'inline-block')
									.empty()
									.text(self.getTemplate({
										name: '!' + self.i18n.active().devices.popupSettings.restrictions.matcher.denyMessage,
										data: {
											phoneNumber: monster.util.formatPhoneNumber(number)
										}
									}));
							}
						}
					});
				} else {
					templateDevice.find('.restriction-matcher-sign').hide();
					templateDevice.find('.restriction-message').hide();
				}
			});

			templateDevice.find('.feature-key-type').on('change', function() {
				var $this = $(this),
					type = $this.val(),
					$featureKeyValue = $this.closest('.feature-key-value');

				$featureKeyValue.siblings('.feature-key-value.active[data-type]').removeClass('active');
				$featureKeyValue.siblings('.feature-key-value[data-type~="' + type + '"]').addClass('active');
			});

			templateDevice.find('.tabs-section[data-section="featureKeys"] .type-info a').on('click', function() {
				var $this = $(this);

				setTimeout(function() {
					var action = ($this.hasClass('collapsed') ? 'show' : 'hide').concat('Info');

					$this.find('.text').text(self.i18n.active().devices.popupSettings.keys.info.link[action]);
				});
			});

			var popup = monster.ui.dialog(templateDevice, {
				title: popupTitle,
				dialogClass: 'voip-edit-device-popup'
			});
		},

		devicesRestart: function(deviceId, callback) {
			var self = this;

			self.callApi({
				resource: 'device.restart',
				data: {
					accountId: self.accountId,
					deviceId: deviceId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		devicesUnlock: function(macAddress, callback) {
			var self = this;

			monster.request({
				resource: 'provisioner.devices.unlock',
				data: {
					accountId: self.accountId,
					macAddress: macAddress
				},
				success: function(data, status) {
					callback && callback();
				}
			});
		},

		devicesMergeData: function(originalData, template, audioCodecs, videoCodecs) {
			var self = this,
				hasCodecs = $.inArray(originalData.device_type, ['sip_device', 'landline', 'fax', 'ata', 'softphone', 'smartphone', 'mobile', 'sip_uri']) > -1,
				hasCallForward = $.inArray(originalData.device_type, ['landline', 'cellphone', 'smartphone']) > -1,
				hasRTP = $.inArray(originalData.device_type, ['sip_device', 'mobile', 'softphone']) > -1,
				formData = monster.ui.getFormData('form_device'),
				isValuePropertyEmpty = function(data, property) {
					return _
						.chain(data)
						.get(['value', property])
						.trim()
						.isEmpty()
						.value();
				};

			if ('mac_address' in formData) {
				formData.mac_address = monster.util.formatMacAddress(formData.mac_address);
			}

			if (hasCallForward) {
				formData.call_forward = $.extend(true, {
					enabled: true,
					require_keypress: true,
					keep_caller_id: true
				}, formData.call_forward);

				if (originalData.device_type === 'smartphone') {
					formData.call_forward.failover = true;
				}

				if (formData.hasOwnProperty('extra') && formData.extra.allowVMCellphone) {
					formData.call_forward.require_keypress = !formData.extra.allowVMCellphone;
				}
			}

			if (hasCodecs) {
				formData.media = $.extend(true, {
					audio: {
						codecs: []
					},
					video: {
						codecs: []
					}
				}, formData.media);
			}

			if ('call_restriction' in formData) {
				_.each(formData.call_restriction, function(restriction, key) {
					if (key in originalData.extra.restrictions && originalData.extra.restrictions[key].disabled) {
						restriction.action = originalData.extra.restrictions[key].action;
					} else {
						restriction.action = restriction.action === true ? 'inherit' : 'deny';
					}
				});
			}

			if (_.has(formData, 'provision.keys')) {
				/**
				 * form2object sends keys back as arrays even if the first key is 1
				 * they needs to be coerced into an object to match the datatype in originalData
				 */
				_.each(formData.provision.keys, function(value, key, list) {
					var keys = {};

					_.each(list[key], function(val, idx) {
						if (val.type === 'none') {
							keys[idx] = null;
						} else {
							if (key === 'combo_keys' && val.type === 'parking') {
								val.value.value = _.parseInt(val.value.value, 10);
							}

							if (key !== 'combo_keys' || isValuePropertyEmpty(val, 'label')) {
								if (isValuePropertyEmpty(val, 'value')) {
									delete val.value;
								} else {
									val.value = val.value.value;
								}
							}
							keys[idx] = val;
						}
					});

					if (_.isEmpty(keys)) {
						delete originalData.provision[key];
					} else {
						originalData.provision[key] = keys;
					}
				});

				delete formData.provision.keys;
			}

			var mergedData = $.extend(true, {}, originalData, formData);

			/* The extend doesn't override an array if the new array is empty, so we need to run these snippet after the merge */
			if (hasRTP) {
				mergedData.media.encryption.methods = [];

				if (mergedData.media.encryption.enforce_security) {
					mergedData.media.encryption.methods.push(formData.extra.rtpMethod);
				}
			}

			if (mergedData.extra.hasOwnProperty('notify_unregister')) {
				mergedData.suppress_unregister_notifications = !mergedData.extra.notify_unregister;
			}

			if (hasCodecs) {
				if (audioCodecs) {
					mergedData.media.audio.codecs = audioCodecs.getSelectedItems();
				}

				if (videoCodecs) {
					mergedData.media.video.codecs = videoCodecs.getSelectedItems();
				}
			}

			// If the key is set to "auto" we remove the key, we don't support this anymore
			if (mergedData.hasOwnProperty('media') && mergedData.media.hasOwnProperty('fax_option') && mergedData.media.fax_option === 'auto') {
				delete mergedData.media.fax_option;
			}

			// The UI mistakenly created this key, so we clean it up
			if (mergedData.hasOwnProperty('media') && mergedData.media.hasOwnProperty('fax') && mergedData.media.fax.hasOwnProperty('option')) {
				delete mergedData.media.fax.option;
			}

			if (mergedData.hasOwnProperty('caller_id_options') && mergedData.caller_id_options.hasOwnProperty('outbound_privacy') && mergedData.caller_id_options.outbound_privacy === 'default') {
				delete mergedData.caller_id_options.outbound_privacy;

				if (_.isEmpty(mergedData.caller_id_options)) {
					delete mergedData.caller_id_options;
				}
			}

			if (mergedData.hasOwnProperty('caller_id') && mergedData.caller_id.hasOwnProperty('emergency') && mergedData.caller_id.emergency.hasOwnProperty('number') && mergedData.caller_id.emergency.number === '') {
				delete mergedData.caller_id.emergency.number;

				if (_.isEmpty(mergedData.caller_id.emergency)) {
					delete mergedData.caller_id.emergency;
				}
			}

			//if there is no owner, do not add one.
			if (mergedData.owner_id && mergedData.owner_id === 'none') {
				delete mergedData.owner_id;
			}

			/* Migration clean-up */
			delete mergedData.media.secure_rtp;
			delete mergedData.extra;

			return mergedData;
		},

		/**
		 * @param  {Object} data
		 * @param  {Object} data.device
		 * @param  {String} data.device.device_type
		 * @param  {Object} data.e911Numbers
		 * @param  {Object} data.accountLimits
		 * @param  {Object} data.listClassifiers
		 * @param  {Object} data.users
		 * @param  {Object} [data.template]
		 * @param  {Boolean} [dataList.isRegistered]
		 * @return {Object}
		 */
		devicesFormatData: function(data, dataList) {
			var self = this,
				isClassifierDisabledByAccount = function isClassifierDisabledByAccount(classifier) {
					return _.get(data.accountLimits, ['call_restriction', classifier, 'action']) === 'deny';
				},
				deviceDefaults = {
					call_restriction: {},
					device_type: 'sip_device',
					enabled: true,
					media: {
						audio: {
							codecs: ['PCMA', 'PCMU']
						},
						encryption: {
							enforce_security: false
						},
						video: {
							codecs: []
						}
					},
					suppress_unregister_notifications: true
				},
				callForwardSettings = {
					call_forward: {
						require_keypress: true,
						keep_caller_id: true
					},
					contact_list: {
						exclude: true
					}
				},
				sipSettings = {
					sip: {
						password: monster.util.randomString(12),
						realm: monster.apps.auth.currentAccount.realm,
						username: 'user_' + monster.util.randomString(10)
					}
				},
				deviceDefaultsForType = _.get({
					ata: _.merge({}, sipSettings),
					cellphone: _.merge({}, callForwardSettings),
					fax: _.merge({
						media: {
							fax_option: 'false'
						},
						outbound_flags: [
							'fax'
						]
					}, sipSettings),
					landline: _.merge({}, callForwardSettings),
					mobile: _.merge({}, sipSettings),
					sip_device: _.merge({}, sipSettings),
					sip_uri: {
						sip: _.merge({
							expire_seconds: 360,
							invite_format: 'route',
							method: 'password'
						}, _.pick(sipSettings.sip, [
							'password',
							'username'
						]))
					},
					smartphone: _.merge({}, sipSettings, callForwardSettings),
					softphone: _.merge({}, sipSettings)
				}, data.device.device_type, {}),
				deviceOverrides = {
					provision: _
						.chain(data.template)
						.thru(self.getKeyTypes)
						.map(function(type) {
							return {
								type: type,
								data: _
									.chain(data.template)
									.get([type, 'iterate'], 0)
									.range()
									.map(function(index) {
										return _.get(data.device, ['provision', type, index], {
											type: 'none'
										});
									})
									.value()
							};
						})
						.keyBy('type')
						.mapValues('data')
						.value()
				},
				mergedDevice = _.merge(
					{},
					deviceDefaults,
					deviceDefaultsForType,
					data.device,
					deviceOverrides
				);

			return _.merge({
				extra: {
					allowVMCellphone: !_.get(mergedDevice, 'call_forward.require_keypress', true),
					availableCodecs: {
						audio: [],
						video: []
					},
					e911Numbers: data.e911Numbers,
					hasDisabledRestrictions: _.some(data.listClassifiers, function(metadata, classifier) {
						return isClassifierDisabledByAccount(classifier);
					}),
					hasE911Numbers: !_.isEmpty(data.e911Numbers),
					isRegistered: _.get(dataList, 'isRegistered', false),
					outboundPrivacy: _.map(self.appFlags.common.outboundPrivacy, function(strategy) {
						return {
							key: strategy,
							value: monster.util.tryI18n(self.i18n.active().commonMisc.outboundPrivacy.values, strategy)
						};
					}),
					provision: {
						keys: _
							.chain(data.template)
							.thru(self.getKeyTypes)
							.map(function(type) {
								var camelCasedType = _.camelCase(type),
									i18n = _.get(self.i18n.active().devices.popupSettings.keys, camelCasedType);

								return _.merge({
									id: type,
									type: camelCasedType,
									actions: _
										.chain([
											'none',
											'presence',
											'parking',
											'personal_parking',
											'speed_dial'
										])
										.concat(
											type === 'combo_keys' ? ['line'] : []
										)
										.map(function(action) {
											var i18n = self.i18n.active().devices.popupSettings.keys;

											return {
												id: action,
												info: _.get(i18n, ['info', 'types', action]),
												label: _.get(i18n, ['types', action])
											};
										})
										// Sort alphabetically while keeping `none` as first item
										.sort(function(a, b) {
											return a.id === 'none' ? -1
												: b.id === 'none' ? 1
												: a.label.localeCompare(b.label, monster.config.whitelabel.language);
										})
										.value(),
									data: _
										.chain(mergedDevice)
										.get(['provision', type], [])
										.map(function(metadata) {
											var value = _.get(metadata, 'value', {});

											return _.merge({}, metadata, _.isPlainObject(value)
												? {}
												: {
													value: {
														value: _.toString(value)
													}
												}
											);
										})
										.value()
								}, _.pick(i18n, [
									'title',
									'label'
								]));
							})
							.value(),
						parkingSpots: _.range(1, 11)
					},
					restrictions: _.mapValues(data.listClassifiers, function(metadata, classifier) {
						var i18n = _.get(self.i18n.active().devices.classifiers, classifier);

						return {
							action: _.get(data.device, ['call_restriction', classifier, 'action'], 'inherit'),
							disabled: isClassifierDisabledByAccount(classifier),
							friendly_name: _.get(i18n, 'name', metadata.friendly_name),
							help: _.get(i18n, 'help')
						};
					}),
					rtpMethod: _.get(mergedDevice, 'media.encryption.enforce_security', false)
						? _.head(mergedDevice.media.encryption.methods)
						: '',
					selectedCodecs: {
						audio: [],
						video: []
					},
					users: _.sortBy(data.users, function(user) {
						return _
							.chain(user)
							.thru(monster.util.getUserFullName)
							.toLower()
							.value();
					})
				}
			}, mergedDevice);
		},

		/**
		 * @param  {Object} data
		 * @param  {Object} data.users
		 * @param  {Object} data.status
		 * @param  {Object} data.devices
		 * @return {Object}
		 */
		devicesFormatListData: function(data) {
			var self = this,
				getIconClassForDeviceType = function getIconClassForDeviceType(type) {
					var knownType = _.has(self.appFlags.devices.iconClassesByDeviceTypes, type) ? type : 'sip_device';
					return _.get(self.appFlags.devices.iconClassesByDeviceTypes, knownType);
				},
				usersById = _.keyBy(data.users, 'id'),
				unassignedString = self.i18n.active().devices.unassignedDevice,
				registeredDevicesById = _.map(data.status, 'device_id');

			return {
				countDevices: _.size(data.devices),
				devices: _
					.chain(data.devices)
					.map(function(device) {
						var staticStatusClasses = ['unregistered', 'registered'],
							deviceType = device.device_type,
							isRegistered = _.includes(['sip_device', 'smartphone', 'softphone', 'fax', 'ata'], deviceType)
								? _.includes(registeredDevicesById, device.id)
								: true,
							isEnabled = _.get(device, 'enabled', false),
							userName = _
								.chain(usersById)
								.get(device.owner_id, {
									first_name: unassignedString,
									last_name: ''
								})
								.thru(monster.util.getUserFullName)
								.value();

						return _.merge({
							// Display a device in black if it's disabled, otherwise, until we know whether it's registered or not, we set the color to red
							classStatus: isEnabled ? staticStatusClasses[_.toNumber(isRegistered)] : 'disabled',
							enabled: isEnabled,
							friendlyIconClass: getIconClassForDeviceType(deviceType),
							friendlyType: monster.util.tryI18n(self.i18n.active().devices.types, deviceType),
							isAssigned: _
								.chain(device)
								.has('owner_id')
								.toString()
								.value(),
							isEditable: _.includes(self.appFlags.devices.editableDeviceTypes, deviceType),
							// Even though a device is registered, we don't count it as registered if it's disabled
							isRegistered: isEnabled && isRegistered,
							macAddress: device.mac_address,
							registered: isRegistered,
							sipUserName: device.userName,
							sortableUserName: userName.split(' ').reverse().join(' '),
							type: deviceType,
							userName: userName
						}, _.pick(device, [
							'id',
							'name'
						]));
					})
					.sort(function(a, b) {
						// If owner is the same, order by device name
						if (a.userName === b.userName) {
							var aName = a.name.toLowerCase(),
								bName = b.name.toLowerCase();

							return (aName > bName) ? 1 : (aName < bName) ? -1 : 0;
						} else {
							// Otherwise, push the unassigned devices to the bottom of the list, and show the assigned devices ordered by user name
							if (a.userName === unassignedString) {
								return 1;
							} else if (b.userName === unassignedString) {
								return -1;
							} else {
								var aSortName = a.sortableUserName.toLowerCase(),
									bSortName = b.sortableUserName.toLowerCase();

								return (aSortName > bSortName) ? 1 : (aSortName < bSortName) ? -1 : 0;
							}
						}
					})
					.value(),
				deviceTypesToAdd: _.map(self.appFlags.devices.addableDeviceTypes, function(type) {
					return {
						type: type,
						icon: _.get(self.appFlags.devices.iconClassesByDeviceTypes, type)
					};
				})
			};
		},

		devicesHelperDeleteDevice: function(deviceId, onSuccess) {
			var self = this;

			monster.waterfall([
				function(waterfallCb) {
					monster.ui.confirm(self.i18n.active().devices.confirmDeleteDevice, function() {
						waterfallCb(null);
					}, function() {
						waterfallCb(true);
					});
				},
				function(waterfallCb) {
					self.devicesDeleteDevice(deviceId, function(device) {
						waterfallCb(null, device);
					});
				}
			], function(err, device) {
				if (err) {
					return;
				}

				monster.ui.toast({
					type: 'success',
					message: self.getTemplate({
						name: '!' + self.i18n.active().devices.deletedDevice,
						data: {
							deviceName: device.name
						}
					})
				});

				onSuccess && onSuccess(device);
			});
		},

		/* Utils */
		devicesDeleteDevice: function(deviceId, callback) {
			var self = this;

			self.callApi({
				resource: 'device.delete',
				data: {
					accountId: self.accountId,
					deviceId: deviceId,
					data: {}
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		devicesListClassifiers: function(callback) {
			var self = this;

			self.callApi({
				resource: 'numbers.listClassifiers',
				data: {
					accountId: self.accountId
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		devicesGetE911Numbers: function(callback) {
			var self = this;

			self.callApi({
				resource: 'numbers.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: 'false'
					}
				},
				success: function(data) {
					var e911Numbers = {};

					_.each(data.data.numbers, function(val, key) {
						if (val.features.indexOf('e911') >= 0) {
							e911Numbers[key] = self.devicesFormatNumber(val);
						}
					});

					callback(e911Numbers);
				}
			});
		},

		devicesFormatNumber: function(value) {
			var self = this;

			return value;
		},

		devicesGetEditData: function(dataDevice, callback) {
			var self = this;

			monster.waterfall([
				function(waterfallCb) {
					monster.parallel({
						listClassifiers: function(callback) {
							self.devicesListClassifiers(function(dataClassifiers) {
								callback(null, dataClassifiers);
							});
						},
						device: function(callback) {
							if (!_.has(dataDevice, 'id')) {
								return callback(null, dataDevice);
							}
							self.devicesGetDevice(dataDevice.id, function(dataDevice) {
								callback(null, dataDevice);
							});
						},
						e911Numbers: function(callback) {
							self.devicesGetE911Numbers(function(e911Numbers) {
								callback(null, e911Numbers);
							});
						},
						accountLimits: function(callback) {
							self.callApi({
								resource: 'limits.get',
								data: {
									accountId: self.accountId
								},
								success: function(data, status) {
									callback(null, data.data);
								}
							});
						},
						users: function(callback) {
							self.devicesListUsers({
								success: function(users, status) {
									callback(null, users);
								}
							});
						}
					}, function(error, results) {
						waterfallCb(null, results);
					});
				},
				function(results, waterfallCb) {
					if (!_.has(results.device, 'provision')) {
						return waterfallCb(null, results);
					}
					self.devicesGetIterator(results.device.provision, function(template) {
						waterfallCb(null, _.merge({
							template: template
						}, results));
					}, function() {
						waterfallCb(null, results);
					});
				}
			], function(err, results) {
				var formattedData = self.devicesFormatData(results, dataDevice);

				callback && callback(formattedData);
			});
		},

		devicesGetDevice: function(deviceId, callbackSuccess, callbackError) {
			var self = this;

			self.callApi({
				resource: 'device.get',
				data: {
					accountId: self.accountId,
					deviceId: deviceId
				},
				success: function(data) {
					callbackSuccess && callbackSuccess(data.data);
				},
				error: function(data) {
					callbackError && callbackError(data);
				}
			});
		},

		/**
		 * @param  {Object} deviceData
		 * @param  {Function} callbackSuccess
		 * @param  {Function} [callbackError]
		 */
		devicesSaveDevice: function(deviceData, callbackSuccess, callbackError) {
			var self = this;

			if (deviceData.id) {
				self.devicesUpdateDevice(deviceData, callbackSuccess, callbackError);
			} else {
				self.devicesCreateDevice(deviceData, callbackSuccess, callbackError);
			}
		},

		/**
		 * @param  {Object} deviceData
		 * @param  {Function} callbackSuccess
		 * @param  {Function} [callbackError]
		 */
		devicesCreateDevice: function(deviceData, callbackSuccess, callbackError) {
			var self = this;

			self.callApi({
				resource: 'device.create',
				data: {
					accountId: self.accountId,
					data: deviceData
				},
				success: function(data) {
					callbackSuccess(data.data);
				},
				error: function(data) {
					callbackError && callbackError(data);
				}
			});
		},

		/**
		 * @param  {Object} deviceData
		 * @param  {Function} callbackSuccess
		 * @param  {Function} [callbackError]
		 */
		devicesUpdateDevice: function(deviceData, callbackSuccess, callbackError) {
			var self = this;

			self.callApi({
				resource: 'device.update',
				data: {
					accountId: self.accountId,
					data: deviceData,
					deviceId: deviceData.id
				},
				success: function(data) {
					callbackSuccess && callbackSuccess(data.data);
				},
				error: function(data) {
					callbackError && callbackError(data);
				}
			});
		},

		devicesGetData: function(callback) {
			var self = this;

			monster.parallel({
				users: function(callback) {
					self.callApi({
						resource: 'user.list',
						data: {
							accountId: self.accountId,
							filters: {
								paginate: 'false'
							}
						},
						success: function(dataUsers) {
							callback && callback(null, dataUsers.data);
						}
					});
				},
				status: function(callback) {
					self.callApi({
						resource: 'device.getStatus',
						data: {
							accountId: self.accountId,
							filters: {
								paginate: 'false'
							}
						},
						success: function(dataStatus) {
							callback && callback(null, dataStatus.data);
						}
					});
				},
				devices: function(callback) {
					self.callApi({
						resource: 'device.list',
						data: {
							accountId: self.accountId,
							filters: {
								paginate: 'false'
							}
						},
						success: function(dataDevices) {
							callback(null, dataDevices.data);
						}
					});
				}
			}, function(err, results) {
				callback && callback(results);
			});
		},

		devicesGetE911NumberAddress: function(number, callback) {
			var self = this;

			self.callApi({
				resource: 'numbers.get',
				data: {
					accountId: self.accountId,
					phoneNumber: encodeURIComponent(number)
				},
				success: function(_data, status) {
					var street_address = _data.data.e911.street_address,
						locality = _data.data.e911.locality,
						postal_code = _data.data.e911.postal_code,
						region = _data.data.e911.region;

					if (typeof _data.data.e911.extended_address !== 'undefined') {
						callback(street_address + ', ' + _data.data.e911.extended_address + '<br>' + locality + ', ' + region + ' ' + postal_code);
					} else {
						callback(street_address + ', ' + '<br>' + locality + ', ' + region + ' ' + postal_code);
					}
				}
			});
		},

		devicesGetIterator: function(args, callbackSuccess, callbackError) {
			var self = this;

			if (args.hasOwnProperty('endpoint_brand') && args.hasOwnProperty('endpoint_family') && args.hasOwnProperty('endpoint_model')) {
				monster.request({
					resource: 'provisioner.ui.getModel',
					data: {
						brand: args.endpoint_brand,
						family: args.endpoint_family,
						model: args.endpoint_model
					},
					success: function(data, status) {
						callbackSuccess && callbackSuccess(data.data.template);
					},
					error: function(data, status) {
						callbackError && callbackError();
					}
				});
			} else {
				callbackError && callbackError();
			}
		},

		devicesListUsers: function(args) {
			var self = this;

			self.callApi({
				resource: 'user.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: 'false'
					}
				},
				success: function(data, status) {
					args.hasOwnProperty('success') && args.success(data.data);
				},
				error: function(data, status) {
					args.hasOwnProperty('error') && args.error();
				}
			});
		}
	};

	return app;
});
