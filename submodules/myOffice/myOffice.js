define(function(require){
	var $ = require('jquery'),
		_ = require('underscore'),
		monster = require('monster'),
		chart = require('chart');

	var app = {

		requests: {},

		subscribe: {
			'voip.myOffice.render': 'myOfficeRender',
			'myaccount.closed': 'myOfficeMyAccountClosed'
		},

		chartColors: [
			"#B588B9", // Purple ~ Mauve
			"#698BF7", // Purple ~ Dark Blue
			"#009AD6", // Blue
			"#6CC5E9", // Light Blue
			"#719B11", // Dark Green
			"#BDE55F", // Light Green
			"#F1E87C", // Pale Yellow
			"#EF8F25", // Orange
			"#6F7C7D"  // Grey
		],

		/* My Office */
		myOfficeRender: function(args) {
			var self = this,
				parent = args.parent || $('.right-content');

			self.myOfficeLoadData(function(myOfficeData) {
				var dataTemplate = {
						account: myOfficeData.account,
						totalUsers: myOfficeData.users.length,
						totalDevices: myOfficeData.devices.length,
						unregisteredDevices: myOfficeData.devices.length - myOfficeData.devicesStatus.length,
						totalNumbers: _.size(myOfficeData.numbers),
						totalConferences: myOfficeData.totalConferences,
						totalChannels: myOfficeData.totalChannels,
						mainNumbers: myOfficeData.mainNumbers || [],
						confNumbers: myOfficeData.confNumbers || [],
						faxNumbers: myOfficeData.faxNumbers || [],
						topMessage: myOfficeData.topMessage,
						devicesList: _.toArray(myOfficeData.devicesData).sort(function(a, b) { return b.count - a.count ; }),
						assignedNumbersList: _.toArray(myOfficeData.assignedNumbersData).sort(function(a, b) { return b.count - a.count ; }),
						// numberTypesList: _.toArray(myOfficeData.numberTypesData).sort(function(a, b) { return b.count - a.count ; }),
						classifiedNumbers: myOfficeData.classifiedNumbers
					},
					template = $(monster.template(self, 'myOffice-layout', dataTemplate)),
					chartOptions = {
						animateScale: true,
						segmentShowStroke: false,
						// segmentStrokeWidth: 1,
						animationSteps: 50,
						animationEasing: "easeOutCirc",
						percentageInnerCutout: 60
					},
					devicesChart = new Chart(template.find('#dashboard_devices_chart').get(0).getContext("2d")).Doughnut(
						myOfficeData.devicesData.totalCount > 0 ?
						$.map(myOfficeData.devicesData, function(val) {
							return typeof val === 'object' ? {
								value: val.count,
								color: val.color
							} : null;
						}).sort(function(a, b) { return b.value - a.value ; }) :
						[{ value:1, color:"#DDD" }],
						chartOptions
					),
					assignedNumbersChart = new Chart(template.find('#dashboard_assigned_numbers_chart').get(0).getContext("2d")).Doughnut(
						myOfficeData.assignedNumbersData.totalCount > 0 ?
						$.map(myOfficeData.assignedNumbersData, function(val) {
							return typeof val === 'object' ? {
								value: val.count,
								color: val.color
							} : null;
						}).sort(function(a, b) { return b.value - a.value ; }) :
						[{ value:1, color:"#DDD" }],
						chartOptions
					),
					numberTypesChart = new Chart(template.find('#dashboard_number_types_chart').get(0).getContext("2d")).Doughnut(
						// $.map(myOfficeData.numberTypesData, function(val) {
						// 	return {
						// 		value: val.count,
						// 		color: val.color
						// 	};
						// }).sort(function(a, b) { return b.value - a.value ; }),
						myOfficeData.classifiedNumbers.length > 0 ?
						$.map(myOfficeData.classifiedNumbers, function(val, index) {
							return typeof val === 'object' ? {
								value: val.count,
								color: val.color
							} : null;
						}) :
						[{ value:1, color:"#DDD" }],
						chartOptions
					);

				// Trick to adjust the vertical positioning of the number types legend
				if(myOfficeData.classifiedNumbers.length <= 3) {
					template.find('.number-types-legend').addClass('size-'+myOfficeData.classifiedNumbers.length);
				}

				self.myOfficeBindEvents({
					parent: parent,
					template: template,
					myOfficeData: myOfficeData
				});

				parent
					.empty()
					.append(template);
			});
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
					})
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
						'filter_type':'mainVMBox'
					}
				},
				success: function(vmboxes) {
					if(vmboxes.data.length > 0) {
						hasVMBoxCallback && hasVMBoxCallback(vmboxes[0]);
					}
					else {
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
									paginate: 'false'
								}
							},
							success: function(data) {
								parallelCallback && parallelCallback(null, data.data);
							}
						});
					},
					devicesStatus: function(parallelCallback) {
						self.callApi({
							resource: 'device.getStatus',
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
					numberFeatures: function(callback) {
						monster.pub('common.numbers.getListFeatures', function(features) {
							callback(null, features);
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
					}
				},
				function(error, results) {
					callback && callback(self.myOfficeFormatData(results));
				}
			);
		},

		myOfficeFormatData: function(data) {
			var self = this,
				devices = {
					"sip_device": {
						label: self.i18n.active().devices.types.sip_device,
						count: 0,
						color: self.chartColors[5]
					},
					"cellphone": {
						label: self.i18n.active().devices.types.cellphone,
						count: 0,
						color: self.chartColors[3]
					},
					"smartphone": {
						label: self.i18n.active().devices.types.smartphone,
						count: 0,
						color: self.chartColors[2]
					},
					"mobile": {
						label: self.i18n.active().devices.types.mobile,
						count: 0,
						color: self.chartColors[1]
					},
					"softphone": {
						label: self.i18n.active().devices.types.softphone,
						count: 0,
						color: self.chartColors[0]
					},
					"landline": {
						label: self.i18n.active().devices.types.landline,
						count: 0,
						color: self.chartColors[6]
					},
					"fax": {
						label: self.i18n.active().devices.types.fax,
						count: 0,
						color: self.chartColors[7]
					},
					"ata": {
						label: self.i18n.active().devices.types.ata,
						count: 0,
						color: self.chartColors[8]
					},
					"sip_uri": {
						label: self.i18n.active().devices.types.sip_uri,
						count: 0,
						color: self.chartColors[4]
					},
					totalCount: 0
				},
				assignedNumbers = {
					"spare": {
						label: self.i18n.active().myOffice.numberChartLegend.spare,
						count: 0,
						color: self.chartColors[8]
					},
					"assigned": {
						label: self.i18n.active().myOffice.numberChartLegend.assigned,
						count: 0,
						color: self.chartColors[3]
					},
					totalCount: 0
				},
				// numberTypes = {
				// 	"local": {
				// 		label: self.i18n.active().myOffice.numberChartLegend.local,
				// 		count: 0,
				// 		color: "#6cc5e9"
				// 	},
				// 	"tollfree": {
				// 		label: self.i18n.active().myOffice.numberChartLegend.tollfree,
				// 		count: 0,
				// 		color: "#bde55f"
				// 	},
				// 	"international": {
				// 		label: self.i18n.active().myOffice.numberChartLegend.international,
				// 		count: 0,
				// 		color: "#b588b9"
				// 	}
				// },
				totalConferences = 0,
				channelsArray = [],
				classifierRegexes = {},
				classifiedNumbers = {};

			_.each(data.numbers, function(numData, num) {
				_.find(data.classifiers, function(classifier, classifierKey) {
					if(!(classifierKey in classifierRegexes)) {
						classifierRegexes[classifierKey] = new RegExp(classifier.regex);
					}
					if(classifierRegexes[classifierKey].test(num)) {
						if(classifierKey in classifiedNumbers) {
							classifiedNumbers[classifierKey] ++;
						} else {
							classifiedNumbers[classifierKey] = 1;
						}
						return true;
					} else {
						return false;
					}
				});
			});

			data.classifiedNumbers = _.map(classifiedNumbers, function(val, key) {
				return { 
					key: key,
					label: key in data.classifiers ? data.classifiers[key].friendly_name : key,
					count: val
				};
			}).sort(function(a,b) { return b.count - a.count });

			var maxLength = self.chartColors.length;
			if(data.classifiedNumbers.length > maxLength) {
				data.classifiedNumbers[maxLength-1].key = 'merged_others';
				data.classifiedNumbers[maxLength-1].label = 'Others';
				while(data.classifiedNumbers.length > maxLength) {
					data.classifiedNumbers[maxLength-1].count += data.classifiedNumbers.pop().count;
				}
			}

			_.each(data.classifiedNumbers, function(val, key) {
				val.color = self.chartColors[key];
			});

			_.each(data.devices, function(val) {
				if(val.device_type in devices) {
					devices[val.device_type].count++;
					devices.totalCount++;
				} else {
					console.log('Unknown device type: '+val.device_type);
				}
			});

			_.each(data.numbers, function(val) {
				if("used_by" in val && val["used_by"].length > 0) {
					assignedNumbers["assigned"].count++;
				} else {
					assignedNumbers["spare"].count++;
				}
				assignedNumbers.totalCount++;

				//TODO: Find out the number type and increment the right category
				// numberTypes["local"].count++;
			});

			_.each(data.users, function(val) {
				if(val.features.indexOf("conferencing") >= 0) {
					totalConferences++;
				}
			});

			_.each(data.callflows, function(val) {
				var numberArrayName = '';
				if(val.type === "main" && val.name === "MainCallflow") {
					numberArrayName = 'mainNumbers';
				} else if(val.type === "conference" && val.name === "MainConference") {
					numberArrayName = 'confNumbers';
				}

				if(numberArrayName.length > 0) {
					if(!(numberArrayName in data)) { data[numberArrayName] = []; }
					_.each(val.numbers, function(num) {
						if(num !== '0' && num !== 'undefined' && num !== 'undefinedconf') {
							var number = {
								number: num,
								features: $.extend(true, {}, data.numberFeatures)
							};
							if(num in data.numbers) {
								_.each(data.numbers[num].features, function(feature) {
									number.features[feature].active = 'active';
								});
							}
							data[numberArrayName].push(number);
						}
					});
				}
			});

			_.each(data.channels, function(val) {
				if(channelsArray.indexOf(val.bridge_id) < 0) {
					channelsArray.push(val.bridge_id);
				}
			})

			if(
				data.mainNumbers
			 && data.mainNumbers.length > 0
			 && (
			 	   !('caller_id' in data.account)
				|| !('emergency' in data.account.caller_id)
				|| !('number' in data.account.caller_id.emergency)
				|| !(data.account.caller_id.emergency.number in data.numbers)
				|| data.numbers[data.account.caller_id.emergency.number].features.indexOf('dash_e911') < 0
				)
			) {
				data.topMessage = {
					class: 'btn-danger',
					message: self.i18n.active().myOffice.missingE911Message
				}
			}

			data.totalChannels = channelsArray.length;
			data.devicesData = devices;
			data.assignedNumbersData = assignedNumbers;
			// data.numberTypesData = numberTypes;
			data.totalConferences = totalConferences;

			return data;
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
				switch(category) {
					case "users":
						$('.category#users').addClass('active');
						monster.pub('voip.users.render', { parent: parent });
						break;
					case "devices":
						$('.category#devices').addClass('active');
						monster.pub('voip.devices.render', { parent: parent });
						break;
					case "numbers":
						$('.category#numbers').addClass('active');
						monster.pub('voip.numbers.render', { parent: parent });
						break;
					case "strategy":
						$('.category#strategy').addClass('active');
						monster.pub('voip.strategy.render', { parent: parent, openElement: subcategory });
						break;
				}
			});

			template.find('.header-link.music-on-hold').on('click', function(e) {
				e.preventDefault();
				self.myOfficeRenderMusicOnHoldPopup({
					account: myOfficeData.account
				});
			});

			template.find('.header-link.caller-id:not(.disabled)').on('click', function(e) {
				e.preventDefault();
				self.myOfficeRenderCallerIdPopup({
					parent: parent,
					myOfficeData: myOfficeData
				});
			});

			template.find('.header-link.caller-id.disabled').on('click', function(e) {
				monster.ui.alert(self.i18n.active().myOffice.missingMainNumberForCallerId);
			});

			monster.ui.tooltips(template);
		},

		myOfficeRenderMusicOnHoldPopup: function(args) {
			var self = this,
				account = args.account,
				silenceMediaId = 'silence_stream://300000';

			self.myOfficeListMedias(function(medias) {
				var templateData = {
						silenceMedia: silenceMediaId,
						mediaList: medias,
						media: 'music_on_hold' in account && 'media_id' in account.music_on_hold ? account.music_on_hold.media_id : undefined
					},
					popupTemplate = $(monster.template(self, 'myOffice-musicOnHoldPopup', templateData)),
					popup = monster.ui.dialog(popupTemplate, {
					title: self.i18n.active().myOffice.musicOnHold.title,
					position: ['center', 20]
				});

				self.myOfficeMusicOnHoldPopupBindEvents({
					popupTemplate: popupTemplate,
					popup: popup,
					account: account
				})
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
					if(newMedia) {
						var mediaSelect = popupTemplate.find('.media-dropdown');
						mediaSelect.append('<option value="'+newMedia.id+'">'+newMedia.name+'</option>');
						mediaSelect.val(newMedia.id);
					}
				};

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
					if(errors.hasOwnProperty('size') && errors.size.length > 0) {
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
				if($(this).hasClass('active')) {
					popupTemplate.find('.upload-div').stop(true, true).slideUp();
				} else {
					popupTemplate.find('.upload-div').stop(true, true).slideDown();
				}
			});

			popupTemplate.find('.upload-cancel').on('click', function() {
				closeUploadDiv();
			});

			popupTemplate.find('.upload-submit').on('click', function() {
				if(mediaToUpload) {
					self.callApi({
						resource: 'media.create',
						data: {
							accountId: self.accountId,
							data: {
								streamable: true,
								name: mediaToUpload.name,
								media_source: "upload",
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

				if(!('music_on_hold' in account)) {
					account.music_on_hold = {};
				}

				if(selectedMedia && selectedMedia.length > 0) {
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
					mainNumbers: myOfficeData.mainNumbers,
					selectedMainNumber: 'caller_id' in myOfficeData.account && 'external' in myOfficeData.account.caller_id ? myOfficeData.account.caller_id.external.number || 'none' : 'none'
				},
				popupTemplate = $(monster.template(self, 'myOffice-callerIdPopup', templateData)),
				e911Form = popupTemplate.find('.emergency-form > form'),
				popup = monster.ui.dialog(popupTemplate, {
					title: self.i18n.active().myOffice.callerId.title,
					position: ['center', 20]
				});

			monster.ui.validate(e911Form, {
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
					}
				}
			});

			monster.ui.valid(e911Form);

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
				loadNumberDetails = function(number) {
					if(number) {
						self.myOfficeGetNumber(number, function(numberData) {
							if("cnam" in numberData) {
								callerIdNameInput.val(numberData.cnam.display_name);
							} else {
								callerIdNameInput.val("");
							}

							if("dash_e911" in numberData) {
								emergencyZipcodeInput.val(numberData.dash_e911.postal_code);
								emergencyAddress1Input.val(numberData.dash_e911.street_address);
								emergencyAddress2Input.val(numberData.dash_e911.extended_address);
								emergencyCityInput.val(numberData.dash_e911.locality);
								emergencyStateInput.val(numberData.dash_e911.region);
							} else {
								emergencyZipcodeInput.val("");
								emergencyAddress1Input.val("");
								emergencyAddress2Input.val("");
								emergencyCityInput.val("");
								emergencyStateInput.val("");
							}
						});
					}
				};

			popupTemplate.find('.cancel-link').on('click', function() {
				popup.dialog('close').remove();
			});

			popupTemplate.find('.upload-cancel').on('click', function() {
				closeUploadDiv();
			});

			callerIdNumberSelect.on('change', function() {
				var selectedNumber = $(this).val();
				if(selectedNumber) {
					popupTemplate.find('.number-feature').slideDown();
					loadNumberDetails(selectedNumber);
				} else {
					popupTemplate.find('.number-feature').slideUp();
				}
			});

			emergencyZipcodeInput.on('blur', function() {
				$.getJSON('http://www.geonames.org/postalCodeLookupJSON?&country=US&callback=?', { postalcode: $(this).val() }, function(response) {
					if (response && response.postalcodes.length && response.postalcodes[0].placeName) {
						emergencyCityInput.val(response.postalcodes[0].placeName);
						emergencyStateInput.val(response.postalcodes[0].adminName1);
					}
				});
			});

			popupTemplate.find('.save').on('click', function() {
				var callerIdNumber = callerIdNumberSelect.val(),
					e911Form = popupTemplate.find('.emergency-form > form'),
					updateAccount = function() {
						self.myOfficeUpdateAccount(account, function(updatedAccount) {
							popup.dialog('close').remove();
							self.myOfficeRender({
								parent: parent
							});
						});
					};
				if(callerIdNumber) {
					if(monster.ui.valid(e911Form)) {
						var callerIdName = callerIdNameInput.val();

						account.caller_id = $.extend(true, {}, account.caller_id, {
							external: {
								number: callerIdNumber
							},
							emergency: {
								number: callerIdNumber
							}
						});

						self.myOfficeGetNumber(callerIdNumber, function(numberData) {
							if(callerIdNumber) {
								$.extend(true, numberData, { cnam: { display_name: callerIdName } });
							} else {
								delete numberData.cnam;
							}

							$.extend(true, numberData, {
								dash_e911: monster.ui.getFormData(e911Form[0])
							});

							self.myOfficeUpdateNumber(numberData, function(data) {
								updateAccount();
							});
						});
					} else {
						monster.ui.alert(self.i18n.active().myOffice.callerId.mandatoryE911Alert);
					}
				} else {
					delete account.caller_id.external;
					delete account.caller_id.emergency;
					updateAccount();
				}
			});

			loadNumberDetails(callerIdNumberSelect.val());
		},

		myOfficeMyAccountClosed: function() {
			var self = this;

			if(self.isActive()) {
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
				flag = self.helpSettings.user.get('showDashboardWalkthrough');

			if(flag !== false) {
				callback && callback();
			}
		},

		// Triggers firstUseWalkthrough. First we render the dropdown, then we show a greeting popup, and once they click go, we render the step by step.
		myOfficeShowWalkthrough: function(callback) {
			var self = this,
				mainTemplate = $('#voip_container'),
				steps =  [
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
				userToSave = self.helpSettings.user.set('showDashboardWalkthrough', false);

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
					phoneNumber: encodeURIComponent(number)
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
					phoneNumber: encodeURIComponent(numberData.id),
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
					filters: { 'key_missing':'type' }
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
		}
	};

	return app;
});
