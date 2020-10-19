define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster'),
		Chart = require('chart');

	var app = {

		requests: {
			'google.geocode.address': {
				apiRoot: '//maps.googleapis.com/',
				url: 'maps/api/geocode/json?address={zipCode}',
				verb: 'GET',
				generateError: false,
				removeHeaders: [
					'X-Kazoo-Cluster-ID',
					'X-Auth-Token',
					'Content-Type'
				]
			}
		},

		subscribe: {
			'voip.myOffice.render': 'myOfficeRender',
			'auth.continueTrial': 'myOfficeWalkthroughRender',
			'myaccount.closed': 'myOfficeAfterMyaccountClosed'
		},

		chartColors: [
			'#B588B9', // Purple ~ Mauve
			'#698BF7', // Purple ~ Dark Blue
			'#009AD6', // Blue
			'#6CC5E9', // Light Blue
			'#719B11', // Dark Green
			'#BDE55F', // Light Green
			'#F1E87C', // Pale Yellow
			'#EF8F25', // Orange
			'#6F7C7D' // Grey
		],

		/* My Office */
		myOfficeRender: function(args) {
			var self = this,
				parent = args.parent || $('.right-content'),
				callback = args.callback;

			self.myOfficeLoadData(function(myOfficeData) {
				var dataTemplate = {
						isCnamEnabled: monster.util.isNumberFeatureEnabled('cnam'),
						account: myOfficeData.account,
						totalUsers: myOfficeData.users.length,
						totalDevices: myOfficeData.devices.length,
						unregisteredDevices: myOfficeData.unregisteredDevices,
						totalNumbers: _.size(myOfficeData.numbers),
						totalConferences: myOfficeData.totalConferences,
						totalChannels: myOfficeData.totalChannels,
						mainNumbers: myOfficeData.mainNumbers || [],
						confNumbers: myOfficeData.confNumbers || [],
						faxingNumbers: myOfficeData.faxingNumbers || [],
						faxNumbers: myOfficeData.faxNumbers || [],
						topMessage: myOfficeData.topMessage,
						devicesList: _.orderBy(myOfficeData.devicesData, 'count', 'desc'),
						usersList: _.orderBy(myOfficeData.usersData, 'count', 'desc'),
						assignedNumbersList: _.orderBy(myOfficeData.assignedNumbersData, 'count', 'desc'),
						classifiedNumbers: _.orderBy(myOfficeData.classifiedNumbers, 'count', 'desc'),
						directoryUsers: myOfficeData.directory.users && (myOfficeData.directory.users.length || 0),
						directoryLink: myOfficeData.directoryLink,
						showUserTypes: self.appFlags.global.showUserTypes
					},
					template = $(self.getTemplate({
						name: 'layout',
						data: dataTemplate,
						submodule: 'myOffice'
					})),
					$devicesCanvas = template.find('#dashboard_devices_chart'),
					$assignedNumbersCanvas = template.find('#dashboard_assigned_numbers_chart'),
					$classifiedNumbersCanvas = template.find('#dashboard_number_types_chart'),
					emptyDataSet = [
						{
							count: 1,
							color: '#ddd'
						}
					],
					devicesDataSet = _.sortBy(myOfficeData.devicesData, 'count'),
					usersDataSet = _.sortBy(myOfficeData.usersData, 'count'),
					assignedNumbersDataSet = _.sortBy(myOfficeData.assignedNumbersData, 'count'),
					classifiedNumbersDataSet = _.sortBy(myOfficeData.classifiedNumbers, 'count'),
					createDoughnutCanvas = function createDoughnutCanvas($target) {
						var args = Array.prototype.slice.call(arguments),
							datasets;

						args.splice(0, 1);

						datasets = args;

						return new Chart($target, $.extend(true, {
							type: 'doughnut',
							options: {
								legend: {
									display: false
								},
								tooltips: {
									enabled: false
								},
								animation: {
									easing: 'easeOutCirc',
									animateScale: true
								},
								events: []
							}
						}, {
							data: {
								datasets: datasets
							}
						}));
					};

				devicesDataSet = _.isEmpty(devicesDataSet) ? emptyDataSet : devicesDataSet;
				usersDataSet = _.isEmpty(usersDataSet) ? emptyDataSet : usersDataSet;
				assignedNumbersDataSet = _.isEmpty(assignedNumbersDataSet) ? emptyDataSet : assignedNumbersDataSet;
				classifiedNumbersDataSet = _.isEmpty(classifiedNumbersDataSet) ? emptyDataSet : classifiedNumbersDataSet;

				// Trick to adjust the vertical positioning of the number types legend
				if (myOfficeData.classifiedNumbers.length <= 3) {
					template.find('.number-types-legend').addClass('size-' + myOfficeData.classifiedNumbers.length);
				}

				self.myOfficeBindEvents({
					parent: parent,
					template: template,
					myOfficeData: myOfficeData
				});

				parent
					.empty()
					.append(template);

				createDoughnutCanvas($devicesCanvas, {
					data: _.map(devicesDataSet, 'count'),
					backgroundColor: _.map(devicesDataSet, 'color'),
					borderWidth: 0
				});

				createDoughnutCanvas($assignedNumbersCanvas, {
					data: _.map(assignedNumbersDataSet, 'count'),
					backgroundColor: _.map(assignedNumbersDataSet, 'color'),
					borderWidth: 0
				});

				createDoughnutCanvas($classifiedNumbersCanvas, {
					data: _.map(classifiedNumbersDataSet, 'count'),
					backgroundColor: _.map(classifiedNumbersDataSet, 'color'),
					borderWidth: 0
				});

				if (dataTemplate.showUserTypes) {
					var $usersCanvas = template.find('#dashboard_user_type_chart');

					createDoughnutCanvas($usersCanvas, {
						data: _.map(usersDataSet, 'count'),
						backgroundColor: _.map(usersDataSet, 'color'),
						borderWidth: 0
					});
				}

				self.myOfficeCheckWalkthrough();

				callback && callback();
			});
		},

		// we check if we have to display the walkthrough:
		// first make sure it's not a trial, then
		// only show it if we've already shown the walkthrough in myaccount
		myOfficeCheckWalkthrough: function() {
			var self = this;

			if (!monster.apps.auth.currentAccount.hasOwnProperty('trial_time_left')) {
				monster.pub('myaccount.hasToShowWalkthrough', function(response) {
					if (response === false) {
						self.myOfficeWalkthroughRender();
					}
				});
			}
		},

		myOfficeAfterMyaccountClosed: function() {
			var self = this;

			// If it's not a trial, we show the Walkthrough the first time
			// because if it's a trial, myOfficeWalkthroughRender will be called by another event
			if (!monster.apps.auth.currentAccount.hasOwnProperty('trial_time_left')) {
				self.myOfficeWalkthroughRender();
			}
		},

		myOfficeCreateMainVMBoxIfMissing: function(callback) {
			var self = this;

			self.myOfficeHasMainVMBox(
				function(vmbox) {
					callback(vmbox);
				},
				function() {
					self.myOfficeCreateMainVMBox(function(vmbox) {
						callback(vmbox);
					});
				}
			);
		},

		myOfficeCreateMainVMBox: function(callback) {
			var self = this,
				vmboxData = {
					mailbox: '0',
					type: 'mainVMBox',
					name: self.i18n.active().myOffice.mainVMBoxName,
					delete_after_notify: true
				};

			self.callApi({
				resource: 'voicemail.create',
				data: {
					accountId: self.accountId,
					data: vmboxData
				},
				success: function(vmbox) {
					callback && callback(vmbox.data);
				}
			});
		},

		myOfficeHasMainVMBox: function(hasVMBoxCallback, noVMBoxCallback) {
			var self = this;

			self.callApi({
				resource: 'voicemail.list',
				data: {
					accountId: self.accountId,
					filters: {
						filter_type: 'mainVMBox'
					}
				},
				success: function(vmboxes) {
					if (vmboxes.data.length > 0) {
						hasVMBoxCallback && hasVMBoxCallback(vmboxes[0]);
					} else {
						noVMBoxCallback && noVMBoxCallback();
					}
				}
			});
		},

		myOfficeLoadData: function(callback) {
			var self = this;

			monster.parallel({
				account: function(parallelCallback) {
					self.callApi({
						resource: 'account.get',
						data: {
							accountId: self.accountId
						},
						success: function(dataAccount) {
							parallelCallback && parallelCallback(null, dataAccount.data);
						}
					});
				},
				mainVoicemailBox: function(parallelCallback) {
					self.myOfficeCreateMainVMBoxIfMissing(function(vmbox) {
						parallelCallback(null, vmbox);
					});
				},
				users: function(parallelCallback) {
					self.callApi({
						resource: 'user.list',
						data: {
							accountId: self.accountId,
							filters: {
								paginate: 'false'
							}
						},
						success: function(dataUsers) {
							parallelCallback && parallelCallback(null, dataUsers.data);
						}
					});
				},
				devices: function(parallelCallback) {
					self.callApi({
						resource: 'device.list',
						data: {
							accountId: self.accountId,
							filters: {
								with_status: 'true',
								paginate: 'false'
							}
						},
						success: function(data) {
							parallelCallback && parallelCallback(null, data.data);
						}
					});
				},
				numbers: function(parallelCallback) {
					self.callApi({
						resource: 'numbers.list',
						data: {
							accountId: self.accountId,
							filters: {
								paginate: 'false'
							}
						},
						success: function(data) {
							parallelCallback && parallelCallback(null, data.data.numbers);
						}
					});
				},
				channels: function(parallelCallback) {
					self.callApi({
						resource: 'channel.list',
						data: {
							accountId: self.accountId,
							filters: {
								paginate: 'false'
							}
						},
						success: function(data) {
							parallelCallback && parallelCallback(null, data.data);
						}
					});
				},
				callflows: function(parallelCallback) {
					self.callApi({
						resource: 'callflow.list',
						data: {
							filters: {
								has_type: 'type',
								paginate: 'false'
							},
							accountId: self.accountId
						},
						success: function(data) {
							parallelCallback && parallelCallback(null, data.data);
						}
					});
				},
				classifiers: function(parallelCallback) {
					self.callApi({
						resource: 'numbers.listClassifiers',
						data: {
							accountId: self.accountId
						},
						success: function(data) {
							parallelCallback && parallelCallback(null, data.data);
						}
					});
				},
				directory: function(parallelCallback) {
					self.callApi({
						resource: 'directory.list',
						data: {
							accountId: self.accountId
						},
						success: function(data, status) {
							var mainDirectory = _.find(data.data, function(val) {
								return val.name === 'SmartPBX Directory';
							});
							if (mainDirectory) {
								self.callApi({
									resource: 'directory.get',
									data: {
										accountId: self.accountId,
										directoryId: mainDirectory.id,
										filters: {
											paginate: false
										}
									},
									success: function(data, status) {
										parallelCallback && parallelCallback(null, data.data);
									},
									error: function(data, status) {
										parallelCallback && parallelCallback(null, {});
									}
								});
							} else {
								parallelCallback && parallelCallback(null, {});
							}
						},
						error: function(data, status) {
							parallelCallback && parallelCallback(null, {});
						}
					});
				}
			}, function(error, results) {
				callback && callback(self.myOfficeFormatData(results));
			});
		},

		myOfficeFormatData: function(data) {
			var self = this,
				getColorByIndex = function getColorByIndex(index, customColors) {
					var colors = customColors || self.chartColors;
					return colors[index % colors.length];
				},
				reduceArrayToChartColorsSize = function reduceArrayToChartColorsSize(array) {
					if (_.size(array) <= _.size(self.chartColors)) {
						return array;
					}
					var newArray = array.slice(0, _.size(self.chartColors) - 1),
						overflowArray = array.slice(_.size(self.chartColors) - 1);
					return _.concat(newArray, {
						label: self.i18n.active().myOffice.others,
						count: _.sumBy(overflowArray, 'count')
					});
				},
				colorsOrderedForDeviceTypes = _.map([5, 0, 3, 1, 2, 4, 6, 7, 8], function(index) {
					return self.chartColors[index];
				}),
				staticNumberStatuses = ['assigned', 'spare'],
				showUserTypes = self.appFlags.global.showUserTypes,
				staticNonNumbers = ['0', 'undefined', 'undefinedconf', 'undefinedfaxing', 'undefinedMainNumber'],
				specialNumberMatchers = {
					mainNumbers: { type: 'main', name: 'MainCallflow' },
					confNumbers: { type: 'conference', name: 'MainConference' },
					faxingNumbers: { type: 'faxing', name: 'MainFaxing' }
				},
				knownDeviceTypes = [
					'softphone',
					'mobile',
					'smartphone',
					'cellphone',
					'sip_uri',
					'sip_device',
					'landline',
					'fax',
					'ata',
					'application'
				],
				userCountByServicePlanRole = _
					.chain(data.users)
					.groupBy(function(user) {
						return showUserTypes
							? _
								.chain(user)
								.get('service.plans', { _unassigned: {} })
								.keys()
								.head()
								.value()
							: '_unassigned';
					})
					.mapValues(_.size)
					.value(),
				specialNumbers = _
					.chain(data.callflows)
					.groupBy(function(callflow) {
						return _.findKey(specialNumberMatchers, {
							type: callflow.type,
							name: callflow.name
						});
					})
					.omit('undefined')
					.mapValues(function(callflows) {
						return _.flatMap(callflows, function(callflow) {
							return _
								.chain(callflow.numbers)
								.reject(function(number) {
									return _.includes(staticNonNumbers, number);
								})
								.map(function(number) {
									return _.merge({
										number: number
									}, _.chain(data.numbers)
										.get(number, {})
										.pick('features')
										.value()
									);
								})
								.value();
						});
					})
					.value(),
				topMessage = (function(mainNumbers, account, numbers) {
					var shouldBypassCnam = !monster.util.isNumberFeatureEnabled('cnam'),
						callerIdExternalNumber = _.get(account, 'caller_id.external.number'),
						isExternalNumberSet = _.has(numbers, callerIdExternalNumber),
						hasValidCallerId = shouldBypassCnam || isExternalNumberSet,
						shouldBypassE911 = !monster.util.isNumberFeatureEnabled('e911'),
						callerIdEmergencyNumber = _.get(account, 'caller_id.emergency.number'),
						isEmergencyNumberSet = _
							.chain(numbers)
							.get([callerIdEmergencyNumber, 'features'])
							.includes('e911')
							.value(),
						hasValidE911 = shouldBypassE911 || isEmergencyNumberSet,
						messageKey;

					if (!hasValidCallerId && !hasValidE911) {
						messageKey = 'missingCnamE911Message';
					} else if (!hasValidCallerId) {
						messageKey = 'missingCnamMessage';
					} else if (!hasValidE911) {
						messageKey = 'missingE911Message';
					}
					return !_.isEmpty(mainNumbers) && messageKey
						? {
							cssClass: 'btn-danger',
							message: _.get(self.i18n.active().myOffice, messageKey),
							category: 'myOffice',
							subcategory: 'callerIdDialog'
						}
						: undefined;
				}(specialNumbers.mainNumbers, data.account, data.numbers));

			return _.merge({
				assignedNumbersData: _
					.chain(data.numbers)
					.groupBy(function(number) {
						return staticNumberStatuses[_.chain(number).get('used_by', '').isEmpty().toNumber().value()];
					})
					.map(function(numbers, type) {
						return {
							label: monster.util.tryI18n(self.i18n.active().myOffice.numberChartLegend, type),
							count: _.size(numbers),
							color: _
								.chain(staticNumberStatuses)
								.indexOf(type)
								.thru(function(index) {
									return getColorByIndex((index * 5) + 3);
								})
								.value()
						};
					})
					.value(),
				classifiedNumbers: _
					.chain(data.numbers)
					.keys()
					.groupBy(function(number) {
						return _.findKey(data.classifiers, function(value) {
							return new RegExp(value.regex).test(number);
						}) || 'unknown';
					})
					.map(function(numbers, classifier) {
						return {
							label: _.get(data.classifiers, [classifier, 'friendly_name'], monster.util.formatVariableToDisplay(classifier)),
							count: _.size(numbers)
						};
					})
					.orderBy('count', 'desc')
					.thru(reduceArrayToChartColorsSize)
					.map(function(metadata, index) {
						return _.merge({
							color: getColorByIndex(index)
						}, metadata);
					})
					.value(),
				devicesData: _
					.chain(data.devices)
					.groupBy('device_type')
					.merge(_.transform(knownDeviceTypes, function(object, type) {
						_.set(object, type, []);
					}, {}))
					.pickBy(function(devices, type) {
						if (!_.includes(knownDeviceTypes, type)) {
							console.log('Unknown device type: ' + type);
						}
						return _.includes(knownDeviceTypes, type);
					})
					.map(function(devices, type) {
						return {
							label: monster.util.tryI18n(self.i18n.active().devices.types, type),
							count: _.size(devices)
						};
					})
					.orderBy('count', 'desc')
					.thru(reduceArrayToChartColorsSize)
					.map(function(metadata, index) {
						return _.merge({
							color: getColorByIndex(index, colorsOrderedForDeviceTypes)
						}, metadata);
					})
					.value(),
				directoryLink: _.has(data, 'directory.id') && self.apiUrl + 'accounts/' + self.accountId + '/directories/' + data.directory.id + '?accept=pdf&paginate=false&auth_token=' + self.getAuthToken(),
				topMessage: topMessage,
				totalChannels: _
					.chain(data.channels)
					.map('bridge_id')
					.uniq()
					.size()
					.value(),
				totalConferences: _
					.chain(data.users)
					.reject(function(user) {
						return !_.includes(user.features, 'conferencing');
					})
					.size()
					.value(),
				unregisteredDevices: _
					.chain(data.devices)
					.filter(function(device) {
						var type = _.get(device, 'device_type'),
							isDeviceRegistered = device.registrable ? device.registered : true,
							isDeviceTypeKnown = _.includes(knownDeviceTypes, type),
							isDeviceDisabled = !_.get(device, 'enabled', false),
							isDeviceOffline = isDeviceDisabled || !isDeviceRegistered;

						return isDeviceTypeKnown && isDeviceOffline;
					})
					.size()
					.value(),
				usersData: _
					.chain({
						_unassigned: {
							name: self.i18n.active().myOffice.userChartLegend.none
						}
					})
					.merge(showUserTypes ? self.appFlags.global.servicePlansRole : {})
					.map(function(role, id, roles) {
						return {
							label: role.name,
							count: _.get(userCountByServicePlanRole, id, 0),
							color: _
								.chain(roles)
								.keys()
								.indexOf(id)
								.thru(getColorByIndex)
								.value()
						};
					})
					.value()
			}, specialNumbers, data);
		},

		myOfficeBindEvents: function(args) {
			var self = this,
				parent = args.parent,
				template = args.template,
				myOfficeData = args.myOfficeData;

			template.find('.link-box').on('click', function(e) {
				var $this = $(this),
					category = $this.data('category'),
					subcategory = $this.data('subcategory');

				$('.category').removeClass('active');
				switch (category) {
					case 'users':
						$('.category#users').addClass('active');
						monster.pub('voip.users.render', { parent: parent });
						break;
					case 'devices':
						$('.category#devices').addClass('active');
						monster.pub('voip.devices.render', { parent: parent });
						break;
					case 'numbers':
						$('.category#numbers').addClass('active');
						monster.pub('voip.numbers.render', { parent: parent });
						break;
					case 'strategy':
						$('.category#strategy').addClass('active');
						monster.pub('voip.strategy.render', {
							parent: parent,
							openElement: subcategory
						});
						break;
					case 'myOffice':
						self.myOfficeOpenElement({
							data: myOfficeData,
							element: subcategory,
							parent: parent
						});
						break;
				}
			});

			template.find('.header-link.music-on-hold').on('click', function(e) {
				e.preventDefault();
				self.myOfficeRenderMusicOnHoldPopup({
					account: myOfficeData.account
				});
			});

			if (monster.util.isNumberFeatureEnabled('cnam')) {
				template.find('.header-link.caller-id:not(.disabled)').on('click', function(e) {
					e.preventDefault();
					self.myOfficeRenderCallerIdPopup({
						parent: parent,
						myOfficeData: myOfficeData
					});
				});
			}

			template.find('.header-link.caller-id.disabled').on('click', function(e) {
				monster.ui.alert(self.i18n.active().myOffice.missingMainNumberForCallerId);
			});

			monster.ui.tooltips(template);
		},

		/**
		 * Opens an element within this submodule
		 * @param  {Object} args
		 * @param  {Object} args.data  Data to be provided to the element to be displayed
		 * @param  {('callerIdDialog')} args.element  Name of the element to open
		 * @param  {jQuery} args.parent  Parent container
		 */
		myOfficeOpenElement: function(args) {
			var self = this,
				data = args.data,
				element = args.element,
				$parent = args.parent;

			// Currently only the Caller ID dialog is handled
			if (element !== 'callerIdDialog') {
				return;
			}

			self.myOfficeRenderCallerIdPopup({
				parent: $parent,
				myOfficeData: data
			});
		},

		myOfficeRenderMusicOnHoldPopup: function(args) {
			var self = this,
				account = args.account,
				silenceMediaId = 'silence_stream://300000';

			self.myOfficeListMedias(function(medias) {
				var templateData = {
						showMediaUploadDisclosure: monster.config.whitelabel.showMediaUploadDisclosure,
						silenceMedia: silenceMediaId,
						mediaList: medias,
						media: 'music_on_hold' in account && 'media_id' in account.music_on_hold ? account.music_on_hold.media_id : undefined
					},
					popupTemplate = $(self.getTemplate({
						name: 'musicOnHoldPopup',
						data: templateData,
						submodule: 'myOffice'
					})),
					popup = monster.ui.dialog(popupTemplate, {
						title: self.i18n.active().myOffice.musicOnHold.title,
						position: ['center', 20]
					});

				self.myOfficeMusicOnHoldPopupBindEvents({
					popupTemplate: popupTemplate,
					popup: popup,
					account: account
				});
			});
		},

		myOfficeMusicOnHoldPopupBindEvents: function(args) {
			var self = this,
				popupTemplate = args.popupTemplate,
				popup = args.popup,
				account = args.account,
				closeUploadDiv = function(newMedia) {
					mediaToUpload = undefined;
					popupTemplate.find('.upload-div input').val('');
					popupTemplate.find('.upload-div').slideUp(function() {
						popupTemplate.find('.upload-toggle').removeClass('active');
					});
					if (newMedia) {
						var mediaSelect = popupTemplate.find('.media-dropdown');
						mediaSelect.append('<option value="' + newMedia.id + '">' + newMedia.name + '</option>');
						mediaSelect.val(newMedia.id);
					}
				},
				mediaToUpload;

			popupTemplate.find('.upload-input').fileUpload({
				inputOnly: true,
				wrapperClass: 'file-upload input-append',
				btnText: self.i18n.active().myOffice.musicOnHold.audioUploadButton,
				btnClass: 'monster-button',
				maxSize: 5,
				success: function(results) {
					mediaToUpload = results[0];
				},
				error: function(errors) {
					if (errors.hasOwnProperty('size') && errors.size.length > 0) {
						monster.ui.alert(self.i18n.active().myOffice.musicOnHold.fileTooBigAlert);
					}
					popupTemplate.find('.upload-div input').val('');
					mediaToUpload = undefined;
				}
			});

			popupTemplate.find('.cancel-link').on('click', function() {
				popup.dialog('close').remove();
			});

			popupTemplate.find('.upload-toggle').on('click', function() {
				if ($(this).hasClass('active')) {
					popupTemplate.find('.upload-div').stop(true, true).slideUp();
				} else {
					popupTemplate.find('.upload-div').stop(true, true).slideDown();
				}
			});

			popupTemplate.find('.upload-cancel').on('click', function() {
				closeUploadDiv();
			});

			popupTemplate.find('.upload-submit').on('click', function() {
				if (mediaToUpload) {
					self.callApi({
						resource: 'media.create',
						data: {
							accountId: self.accountId,
							data: {
								streamable: true,
								name: mediaToUpload.name,
								media_source: 'upload',
								description: mediaToUpload.name
							}
						},
						success: function(data, status) {
							var media = data.data;
							self.callApi({
								resource: 'media.upload',
								data: {
									accountId: self.accountId,
									mediaId: media.id,
									data: mediaToUpload.file
								},
								success: function(data, status) {
									closeUploadDiv(media);
								},
								error: function(data, status) {
									self.callApi({
										resource: 'media.delete',
										data: {
											accountId: self.accountId,
											mediaId: media.id,
											data: {}
										},
										success: function(data, status) {}
									});
								}
							});
						}
					});
				} else {
					monster.ui.alert(self.i18n.active().myOffice.musicOnHold.emptyUploadAlert);
				}
			});

			popupTemplate.find('.save').on('click', function() {
				var selectedMedia = popupTemplate.find('.media-dropdown option:selected').val();

				if (!('music_on_hold' in account)) {
					account.music_on_hold = {};
				}

				if (selectedMedia && selectedMedia.length > 0) {
					account.music_on_hold = {
						media_id: selectedMedia
					};
				} else {
					account.music_on_hold = {};
				}
				self.myOfficeUpdateAccount(account, function(updatedAccount) {
					popup.dialog('close').remove();
				});
			});
		},

		myOfficeRenderCallerIdPopup: function(args) {
			var self = this,
				parent = args.parent,
				myOfficeData = args.myOfficeData,
				templateData = {
					isE911Enabled: monster.util.isNumberFeatureEnabled('e911'),
					mainNumbers: myOfficeData.mainNumbers,
					selectedMainNumber: 'caller_id' in myOfficeData.account && 'external' in myOfficeData.account.caller_id ? myOfficeData.account.caller_id.external.number || 'none' : 'none'
				},
				popupTemplate = $(self.getTemplate({
					name: 'callerIdPopup',
					data: templateData,
					submodule: 'myOffice'
				})),
				popup = monster.ui.dialog(popupTemplate, {
					autoScroll: false,
					title: self.i18n.active().myOffice.callerId.title,
					position: ['center', 20]
				});

			if (monster.util.isNumberFeatureEnabled('e911')) {
				var e911Form = popupTemplate.find('#emergency_form');

				monster.ui.validate(e911Form, {
					rules: {
						notification_contact_emails: {
							normalizer: _.trim,
							regex: /^(?:([\w+-.%]+@[\w-.]+\.[A-Za-z]{2,4})(?: ?))*$/
						}
					},
					messages: {
						'postal_code': {
							required: '*'
						},
						'street_address': {
							required: '*'
						},
						'locality': {
							required: '*'
						},
						'region': {
							required: '*'
						},
						notification_contact_emails: {
							regex: self.i18n.active().myOffice.callerId.emergencyEmailError
						}
					}
				});

				monster.ui.valid(e911Form);
			}

			self.myOfficeCallerIdPopupBindEvents({
				parent: parent,
				popupTemplate: popupTemplate,
				popup: popup,
				account: myOfficeData.account
			});
		},

		myOfficeCallerIdPopupBindEvents: function(args) {
			var self = this,
				parent = args.parent,
				popupTemplate = args.popupTemplate,
				popup = args.popup,
				account = args.account,
				callerIdNumberSelect = popupTemplate.find('.caller-id-select'),
				callerIdNameInput = popupTemplate.find('.caller-id-name'),
				emergencyZipcodeInput = popupTemplate.find('.caller-id-emergency-zipcode'),
				emergencyAddress1Input = popupTemplate.find('.caller-id-emergency-address1'),
				emergencyAddress2Input = popupTemplate.find('.caller-id-emergency-address2'),
				emergencyCityInput = popupTemplate.find('.caller-id-emergency-city'),
				emergencyStateInput = popupTemplate.find('.caller-id-emergency-state'),
				emergencyEmailInput = popupTemplate.find('.caller-id-emergency-email'),
				editableFeatures = [ 'e911', 'cnam' ],
				loadNumberDetails = function(number, popupTemplate) {
					monster.waterfall([
						function getNumberData(waterfallCallback) {
							if (!number) {
								return waterfallCallback(null, null);
							}

							self.myOfficeGetNumber(number, function(numberData) {
								waterfallCallback(null, numberData);
							});
						},
						function getAllowedFeatures(numberData, waterfallCallback) {
							if (_.isNil(numberData)) {
								return waterfallCallback(null, numberData, []);
							}

							var availableFeatures = monster.util.getNumberFeatures(numberData),
								allowedFeatures = _.intersection(availableFeatures, editableFeatures);

							waterfallCallback(null, numberData, allowedFeatures);
						},
						function fillFormFields(numberData, allowedFeatures, waterfallCallback) {
							if (_.isEmpty(allowedFeatures)) {
								return waterfallCallback(null, allowedFeatures);
							}

							var hasE911 = _.includes(allowedFeatures, 'e911'),
								hasCNAM = _.includes(allowedFeatures, 'cnam'),
								isE911Enabled = monster.util.isNumberFeatureEnabled('e911');

							if (hasE911 && isE911Enabled) {
								if (_.has(numberData, 'e911')) {
									emergencyZipcodeInput.val(numberData.e911.postal_code);
									emergencyAddress1Input.val(numberData.e911.street_address);
									emergencyAddress2Input.val(numberData.e911.extended_address);
									emergencyCityInput.val(numberData.e911.locality);
									emergencyStateInput.val(numberData.e911.region);
									emergencyEmailInput.val(_
										.chain(numberData.e911)
										.get('notification_contact_emails', [])
										.join(' ')
										.value()
									);
								} else {
									emergencyZipcodeInput.val('');
									emergencyAddress1Input.val('');
									emergencyAddress2Input.val('');
									emergencyCityInput.val('');
									emergencyStateInput.val('');
									emergencyEmailInput.val('');
								}
							}

							if (hasCNAM) {
								if (_.has(numberData, 'cnam')) {
									callerIdNameInput.val(numberData.cnam.display_name);
								} else {
									callerIdNameInput.val('');
								}
							}

							waterfallCallback(null, allowedFeatures);
						}
					], function hideOrShowFeatureSections(err, allowedFeatures) {
						_.each(editableFeatures, function(featureName) {
							var $featureSection = popupTemplate.find('.number-feature[data-feature="' + featureName + '"]'),
								isFeatureAllowed = _.includes(allowedFeatures, featureName),
								action = isFeatureAllowed ? 'slideDown' : 'slideUp';

							$featureSection[action]();
						});
					});
				};

			popupTemplate.find('.cancel-link').on('click', function() {
				popup.dialog('close').remove();
			});

			callerIdNumberSelect.on('change', function() {
				loadNumberDetails($(this).val(), popupTemplate);
			});

			emergencyZipcodeInput.on('blur', function() {
				var zipCode = $(this).val();

				if (zipCode) {
					self.myOfficeGetAddessFromZipCode({
						data: {
							zipCode: zipCode
						},
						success: function(results) {
							if (!_.isEmpty(results)) {
								var length = results[0].address_components.length;
								emergencyCityInput.val(results[0].address_components[1].long_name);
								emergencyStateInput.val(results[0].address_components[length - 2].short_name);
							}
						}
					});
				}
			});

			popupTemplate.find('.save').on('click', function() {
				var callerIdNumber = callerIdNumberSelect.val(),
					updateAccount = function() {
						self.myOfficeUpdateAccount(account, function(updatedAccount) {
							popup.dialog('close').remove();
							self.myOfficeRender({
								parent: parent
							});
						});
					},
					setNumberData = function(e911Data) {
						var callerIdName = callerIdNameInput.val(),
							setCNAM = popupTemplate.find('.number-feature[data-feature="cnam"]').is(':visible'),
							setE911 = popupTemplate.find('.number-feature[data-feature="e911"]').is(':visible');

						account.caller_id = $.extend(true, {}, account.caller_id, {
							external: {
								number: callerIdNumber
							},
							emergency: {
								number: callerIdNumber
							}
						});

						if (setCNAM) {
							account.caller_id = $.extend(true, {}, account.caller_id, {
								external: {
									name: callerIdName
								}
							});
						}

						self.myOfficeGetNumber(callerIdNumber, function(numberData) {
							if (setCNAM && callerIdName.length) {
								$.extend(true, numberData, { cnam: { display_name: callerIdName } });
							} else {
								delete numberData.cnam;
							}

							if (setE911) {
								_.assign(numberData, {
									e911: _.assign({}, e911Data, {
										notification_contact_emails: _
											.chain(e911Data)
											.get('notification_contact_emails', '')
											.trim()
											.toLower()
											.split(' ')
											.reject(_.isEmpty)
											.uniq()
											.value()
									})
								});
							} else {
								delete numberData.e911;
							}

							self.myOfficeUpdateNumber(numberData, function(data) {
								updateAccount();
							});
						});
					},
					e911Form;

				if (monster.util.isNumberFeatureEnabled('e911')) {
					e911Form = popupTemplate.find('#emergency_form');
				}

				if (callerIdNumber) {
					if (monster.util.isNumberFeatureEnabled('e911')) {
						if (monster.ui.valid(e911Form)) {
							var e911Data = monster.ui.getFormData(e911Form[0]);

							setNumberData(e911Data);
						} else {
							monster.ui.alert(self.i18n.active().myOffice.callerId.mandatoryE911Alert);
						}
					} else {
						setNumberData();
					}
				} else {
					delete account.caller_id.external;
					delete account.caller_id.emergency;
					updateAccount();
				}
			});

			loadNumberDetails(callerIdNumberSelect.val(), popupTemplate);
		},

		myOfficeWalkthroughRender: function() {
			var self = this;

			if (self.isActive()) {
				// First we check if the user hasn't seen the walkthrough already
				// if he hasn't we show the walkthrough, and once they're done with it, we update their user doc so they won't see the walkthrough again
				self.myOfficeHasWalkthrough(function() {
					self.myOfficeShowWalkthrough(function() {
						self.myOfficeUpdateWalkthroughFlagUser();
					});
				});
			}
		},

		myOfficeHasWalkthrough: function(callback) {
			var self = this,
				flag = self.uiFlags.user.get('showDashboardWalkthrough');

			if (flag !== false) {
				callback && callback();
			}
		},

		// Triggers firstUseWalkthrough. First we render the dropdown, then we show a greeting popup, and once they click go, we render the step by step.
		myOfficeShowWalkthrough: function(callback) {
			var self = this,
				mainTemplate = $('#voip_container'),
				steps = [
					{
						element: mainTemplate.find('.category#myOffice')[0],
						intro: self.i18n.active().myOffice.walkthrough.steps['1'],
						position: 'right'
					},
					{
						element: mainTemplate.find('.category#users')[0],
						intro: self.i18n.active().myOffice.walkthrough.steps['2'],
						position: 'right'
					},
					{
						element: mainTemplate.find('.category#groups')[0],
						intro: self.i18n.active().myOffice.walkthrough.steps['3'],
						position: 'right'
					},
					{
						element: mainTemplate.find('.category#strategy')[0],
						intro: self.i18n.active().myOffice.walkthrough.steps['4'],
						position: 'right'
					}
				];

			monster.ui.stepByStep(steps, function() {
				callback && callback();
			});
		},

		myOfficeUpdateWalkthroughFlagUser: function(callback) {
			var self = this,
				userToSave = self.uiFlags.user.set('showDashboardWalkthrough', false);

			self.myOfficeUpdateOriginalUser(userToSave, function(user) {
				callback && callback(user);
			});
		},

		/* API Calls */
		myOfficeGetNumber: function(number, success, error) {
			var self = this;

			self.callApi({
				resource: 'numbers.get',
				data: {
					accountId: self.accountId,
					phoneNumber: number
				},
				success: function(data, status) {
					success && success(data.data);
				},
				error: function(data, status) {
					error && error(data);
				}
			});
		},

		myOfficeUpdateNumber: function(numberData, success, error) {
			var self = this;

			self.callApi({
				resource: 'numbers.update',
				data: {
					accountId: self.accountId,
					phoneNumber: numberData.id,
					data: numberData
				},
				success: function(data, status) {
					success && success(data.data);
				},
				error: function(data, status) {
					error && error(data);
				}
			});
		},

		myOfficeListMedias: function(callback) {
			var self = this;

			self.callApi({
				resource: 'media.list',
				data: {
					accountId: self.accountId,
					filters: {
						key_missing: 'type'
					}
				},
				success: function(medias) {
					callback && callback(medias.data);
				}
			});
		},

		myOfficeUpdateAccount: function(account, callback) {
			var self = this;

			delete account.extra;

			self.callApi({
				resource: 'account.update',
				data: {
					accountId: self.accountId,
					data: account
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		myOfficeUpdateOriginalUser: function(userToUpdate, callback) {
			var self = this;

			self.callApi({
				resource: 'user.update',
				data: {
					userId: userToUpdate.id,
					accountId: monster.apps.auth.originalAccount.id,
					data: userToUpdate
				},
				success: function(savedUser) {
					callback && callback(savedUser.data);
				}
			});
		},

		myOfficeGetAddessFromZipCode: function(args) {
			var self = this;

			monster.request({
				resource: 'google.geocode.address',
				data: args.data,
				success: function(data, status) {
					args.hasOwnProperty('success') && args.success(data.results);
				},
				error: function(errorPayload, data, globalHandler) {
					args.hasOwnProperty('error') ? args.error() : globalHandler(data, { generateError: true });
				}
			});
		}
	};

	return app;
});
