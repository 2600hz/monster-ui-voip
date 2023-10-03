define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster'),
		timezone = require('monster-timezone');

	var showTeammateDevice = _
		.chain(monster.config)
		.get('allowedExtraDeviceTypes', [])
		.includes('teammate')
		.value();

	var app = {

		requests: {
			/* Provisioner */
			'common.chooseModel.getProvisionerData': {
				apiRoot: monster.config.api.provisioner,
				url: 'phones',
				verb: 'GET'
			}
		},

		subscribe: {
			'voip.users.render': 'usersRender'
		},

		appFlags: {
			users: {
				smartPBXCallflowString: ' SmartPBX\'s Callflow',
				smartPBXConferenceString: ' SmartPBX Conference',
				smartPBXVMBoxString: '\'s VMBox'
			}
		},

		deviceIcons: {
			'cellphone': 'phone',
			'smartphone': 'device-mobile',
			'landline': 'home',
			'mobile': 'device-sprint-phone',
			'softphone': 'device-soft-phone',
			'sip_device': 'device-voip-phone',
			'sip_uri': 'device-voip-phone',
			'fax': 'device-fax',
			'ata': 'device-ata',
			'application': 'apps',
			'teammate': 'device-mst',
			'meta': 'apps'
		},

		/* Users */
		/* args: parent and userId */
		usersRender: function(args) {
			var self = this,
				args = args || {},
				parent = args.parent || $('.right-content'),
				_userId = args.userId,
				_openedTab = args.openedTab,
				_sortBy = args.sortBy,
				callback = args.callback;

			self.overlayRemove();

			self.usersGetData(function(data) {
				var dataTemplate = self.usersFormatListData(data, _sortBy),
					template = $(self.getTemplate({
						name: 'layout',
						data: dataTemplate,
						submodule: 'users'
					})),
					templateUser;

				_.each(dataTemplate.users, function(user) {
					templateUser = $(self.getTemplate({
						name: 'row',
						data: user,
						submodule: 'users'
					}));

					template.find('.user-rows').append(templateUser);
				});

				monster.ui.tooltips(template, {
					options: {
						container: 'body'
					}
				});
				template.find('[data-toggle="popover"]').popover({ container: 'body' });

				self.usersBindEvents(template, parent, dataTemplate);

				parent
					.empty()
					.append(template);

				self.usersCheckWalkthrough();

				if (_userId) {
					var cells = parent.find('.grid-row[data-id=' + _userId + '] .grid-cell');

					monster.ui.highlight(cells);
				}

				if (dataTemplate.users.length === 0) {
					parent.find('.grid-row.title').css('display', 'none');
					parent.find('.no-users-row').css('display', 'block');
				} else {
					parent.find('.grid-row.title').css('display', 'block');
					parent.find('.no-users-row').css('display', 'none');
				}

				if (_userId && _openedTab) {
					template.find('.grid-row[data-id="' + _userId + '"] .grid-cell[data-type="' + _openedTab + '"]').click();
				}

				callback && callback();
			});
		},

		usersCheckWalkthrough: function() {
			var self = this;

			self.usersHasWalkthrough(function() {
				self.usersShowWalkthrough(function() {
					self.usersUpdateWalkthroughFlagUser();
				});
			});
		},

		usersHasWalkthrough: function(callback) {
			var self = this,
				flag = self.uiFlags.user.get('showUsersWalkthrough');

			if (flag !== false && self.appFlags.disableFirstUseWalkthrough !== true) {
				callback && callback();
			}
		},

		usersUpdateWalkthroughFlagUser: function(callback) {
			var self = this,
				userToSave = self.uiFlags.user.set('showUsersWalkthrough', false);

			self.usersUpdateOriginalUser(userToSave, function(user) {
				callback && callback(user);
			});
		},

		usersShowWalkthrough: function(callback) {
			var self = this,
				mainTemplate = $('#voip_container'),
				rowFirstUser = mainTemplate.find('.grid-row:not(.title):first'),
				steps = [
					{
						element: mainTemplate.find('.add-user')[0],
						intro: self.i18n.active().users.walkthrough.steps['1'],
						position: 'right'
					},
					{
						element: rowFirstUser.find('.name')[0],
						intro: self.i18n.active().users.walkthrough.steps['2'],
						position: 'right'
					},
					{
						element: rowFirstUser.find('.extension')[0],
						intro: self.i18n.active().users.walkthrough.steps['3'],
						position: 'bottom'
					},
					{
						element: rowFirstUser.find('.phone-number')[0],
						intro: self.i18n.active().users.walkthrough.steps['4'],
						position: 'bottom'
					},
					{
						element: rowFirstUser.find('.devices')[0],
						intro: self.i18n.active().users.walkthrough.steps['5'],
						position: 'left'
					},
					{
						element: rowFirstUser.find('.features')[0],
						intro: self.i18n.active().users.walkthrough.steps['6'],
						position: 'left'
					}
				];

			monster.ui.stepByStep(steps, function() {
				callback && callback();
			});
		},

		/**
		 * Format user related data
		 * @param  {Object} data
		 * @param  {Object} data.user                User data
		 * @param  {Object} [data.userMainCallflow]  User's main callflow
		 * @param  {Object} [data.userVMBox]         User's main voicemail box
		 * @param  {Object} [data.mainDirectory]     Account's main directory
		 */
		usersFormatUserData: function(data) {
			var self = this,
				getFeatureTitle = function(featureId, defaultKey) {
					var i18n = self.i18n.active().users[featureId].titles,
						key = monster.util.getFeatureConfig(
							['smartpbx', 'users', 'features', featureId, 'i18nLabelPath'],
							defaultKey
						);
					return i18n[key];
				},
				isFeatureAvailable = function(data, id) {
					var isFeatureAvailable = monster.util.isFeatureAvailable(
							['smartpbx', 'users', 'features', _.camelCase(id), 'edit']
						),
						availabilityChecker = _.get(data, 'availabilityChecker', _.stubTrue);

					return _.every([
						isFeatureAvailable,
						availabilityChecker()
					]);
				},
				dataUser = data.user,
				_mainDirectory = data.mainDirectory,
				_mainCallflow = data.userMainCallflow,
				_vmbox = data.userVMBox,
				formattedUser = {
					additionalDevices: 0,
					additionalExtensions: 0,
					additionalNumbers: 0,
					devices: [],
					extension: dataUser.hasOwnProperty('presence_id') ? dataUser.presence_id : '',
					fullName: monster.util.getUserFullName(dataUser),
					hasFeatures: false,
					isAdmin: dataUser.priv_level === 'admin',
					showLicensedUserRoles: _.size(self.appFlags.global.servicePlansRole) > 0,
					licensedUserRole: self.i18n.active().users.licensedUserRoles.none,
					listCallerId: [],
					listExtensions: [],
					listNumbers: [],
					phoneNumber: '',
					differentEmail: dataUser.email !== dataUser.username,
					mapFeatures: _.pickBy({
						caller_id: {
							availabilityChecker: function() {
								var isEditableWhenSetOnAccount = monster.util.isFeatureAvailable(
										'smartpbx.users.features.callerId.editWhenSetOnAccount'
									),
									isNotSetOnAccount = _
										.chain(monster.apps.auth.currentAccount)
										.get('caller_id.external.number')
										.isUndefined()
										.value();

								return isEditableWhenSetOnAccount || isNotSetOnAccount;
							},
							icon: 'fa fa-user',
							iconColor: 'monster-blue',
							title: self.i18n.active().users.caller_id.title
						},
						call_failover: {
							icon: 'fa fa-share',
							iconColor: 'monster-orange',
							title: self.i18n.active().users.call_forward.failover_title,
							hidden: true
						},
						call_forward: {
							icon: 'fa fa-share',
							iconColor: 'monster-yellow',
							title: self.i18n.active().users.call_forward.title
						},
						hotdesk: {
							icon: 'fa fa-fire',
							iconColor: 'monster-orange',
							title: self.i18n.active().users.hotdesk.title
						},
						vmbox: {
							icon: 'icon-telicon-voicemail',
							iconColor: 'monster-green',
							title: getFeatureTitle('vmbox', 'voicemailBox')
						},
						faxing: {
							icon: 'icon-telicon-fax',
							iconColor: 'monster-red',
							title: getFeatureTitle('faxing', 'faxbox')
						},
						conferencing: {
							icon: 'fa fa-comments',
							iconColor: 'monster-grey',
							title: self.i18n.active().users.conferencing.title
						},
						find_me_follow_me: {
							icon: 'fa fa-sitemap',
							iconColor: 'monster-purple',
							title: self.i18n.active().users.find_me_follow_me.title
						},
						music_on_hold: {
							icon: 'fa fa-music',
							iconColor: 'monster-pink',
							title: self.i18n.active().users.music_on_hold.title
						},
						call_recording: {
							icon: 'fa fa-microphone',
							iconColor: 'monster-blue',
							title: self.i18n.active().users.callRecording.title
						},
						do_not_disturb: {
							icon: 'fa fa-ban',
							iconColor: 'monster-red',
							title: self.i18n.active().users.do_not_disturb.title
						}
					}, isFeatureAvailable),
					outboundPrivacy: _.map(self.appFlags.common.outboundPrivacy, function(item) {
						return {
							key: item,
							value: self.i18n.active().commonMisc.outboundPrivacy.values[item]
						};
					})
				};

			if (!('extra' in dataUser)) {
				dataUser.extra = formattedUser;
			}

			if (dataUser.hasOwnProperty('service') && dataUser.service.hasOwnProperty('plans') && _.size(dataUser.service.plans) > 0) {
				var planId;

				for (var key in dataUser.service.plans) {
					if (dataUser.service.plans.hasOwnProperty(key)) {
						planId = key;
						break;
					}
				}

				if (self.appFlags.global.servicePlansRole.hasOwnProperty(planId)) {
					dataUser.extra.licensedUserRole = self.appFlags.global.servicePlansRole[planId].name;
				}
			}

			dataUser.extra.features = _.clone(dataUser.features);

			if (_mainDirectory) {
				dataUser.extra.mainDirectoryId = _mainDirectory.id;

				if ('directories' in dataUser && _mainDirectory.id in dataUser.directories) {
					dataUser.extra.includeInDirectory = true;
				} else {
					dataUser.extra.includeInDirectory = false;
				}
			}

			if (_mainCallflow) {
				dataUser.extra.mainCallflowId = _mainCallflow.id;

				if ('flow' in _mainCallflow) {
					var flow = _mainCallflow.flow,
						module = 'user';

					if (dataUser.extra.features.indexOf('find_me_follow_me') >= 0) {
						module = 'ring_group';
						dataUser.extra.groupTimeout = true;
					}

					while (flow.module !== module && '_' in flow.children) {
						flow = flow.children._;
					}
					dataUser.extra.ringingTimeout = flow.data.timeout;
				}

				// Check if user has vmbox enabled
				if (_.includes(_mainCallflow.modules, 'voicemail')) {
					dataUser.extra.features.push('vmbox');
				}
			}

			if (_vmbox) {
				dataUser.extra.vmbox = _vmbox;
			}

			dataUser.extra.countFeatures = 0;
			_.each(dataUser.extra.features, function(v) {
				if (v in dataUser.extra.mapFeatures) {
					dataUser.extra.countFeatures++;
					dataUser.extra.mapFeatures[v].active = true;
				}
			});

			dataUser.extra.hasFeatures = (dataUser.extra.countFeatures > 0);

			dataUser.extra.adminId = self.userId;

			dataUser.extra.canImpersonate = monster.util.canImpersonate(self.accountId);

			dataUser.extra.presenceIdOptions = [];

			var temp,
				hasValidPresenceID = false,
				addNumberToPresenceOptions = function(number) {
					temp = {
						key: number,
						value: _.startsWith('+', number)
							? monster.util.formatPhoneNumber(number)
							: number
					};

					dataUser.extra.presenceIdOptions.push(temp);
				};

			_.each(dataUser.extra.listExtensions, function(extension) {
				if (dataUser.hasOwnProperty('presence_id') && dataUser.presence_id === extension) {
					hasValidPresenceID = true;
				}

				addNumberToPresenceOptions(extension);
			});

			// Sort it from lower number to greater number
			dataUser.extra.presenceIdOptions.sort(function(a, b) {
				return a.key > b.key ? 1 : -1;
			});

			// If they don't have a valid Presence ID, then we add the "Unset" option
			if (!hasValidPresenceID) {
				dataUser.extra.presenceIdOptions.unshift({ key: 'unset', value: self.i18n.active().users.editionForm.noPresenceID });
			}

			return dataUser;
		},

		usersFormatListData: function(data, _sortBy) {
			var self = this,
				userSort = _.flow(
					_.partial(_.get, _, _sortBy || 'first_name'),
					_.toLower
				),
				getTailSize = _.flow(
					_.tail,
					_.size
				),
				mainUserCallflowsPerUserId = _
					.chain(data.callflows)
					.filter({ type: 'mainUserCallflow' })
					.groupBy('owner_id')
					.mapValues(_.head)
					.value(),
				formatUser = _.partial(function(mainUserCallflowsPerUserId, user) {
					return self.usersFormatUserData({
						user: user,
						userMainCallflow: _.get(mainUserCallflowsPerUserId, user.id)
					});
				}, mainUserCallflowsPerUserId),
				getNumbersExtra = function(numbers, extra) {
					var extensionMaxLength = 7,
						extensions = _
							.chain(numbers)
							.filter(function(number) {
								return _.size(number) < extensionMaxLength && self.isExtensionDisplayable(number);
							})
							.concat(extra.listExtensions)
							.value(),
						phoneNumbers = _.filter(numbers, function(number) {
							return _.size(number) >= extensionMaxLength;
						});
					return {
						listExtensions: extensions,
						listCallerId: phoneNumbers,
						listNumbers: phoneNumbers,
						phoneNumber: _.head(phoneNumbers),
						extension: _.isEmpty(extra.extension)
							? _.head(extensions)
							: extra.extension,
						additionalNumbers: getTailSize(phoneNumbers),
						additionalExtensions: getTailSize(extensions)
					};
				},
				isRegistered = function(device) {
					// TODO: this validation should be removed once the backend returns the actual meta device status.
					if (device.device_type === 'meta') {
						return true;
					}
					return _.every([
						device.enabled,
						device.registrable ? device.registered : true
					]);
				},
				formatDevice = function(device) {
					return _.merge({
						id: device.id,
						name: device.name + ' (' + device.device_type.replace('_', ' ') + ')',
						type: device.device_type,
						registered: isRegistered(device),
						enabled: device.enabled,
						icon: self.deviceIcons[device.device_type]
					}, device.device_type === 'mobile' ? {
						mobile: device.mobile
					} : {});
				},
				getTooltip = function(device) {
					var statusClass = !device.enabled ? 'monster-grey'
						: device.registered ? 'monster-green'
						: 'monster-red';

					return '<i class="' + _.join(['device-popover-icon', self.deviceIcons[device.type], statusClass], ' ') + '"></i>'
						+ device.name
						+ '<br>';
				},
				getDevicesExtra = function(devices) {
					var additionals = _.slice(devices, 2);

					return _.merge({
						devices: devices
					}, !_.isEmpty(additionals) ? {
						additionalDevices: {
							count: _.size(additionals),
							tooltip: _
								.chain(additionals)
								.map(getTooltip)
								.join('')
								.value()
						}
					} : {});
				},
				usableCallflows = _.reject(data.callflows, { type: 'faxing' }),
				numbersPerUserId = _
					.chain(usableCallflows)
					.groupBy('owner_id')
					.mapValues(_.partial(_.flatMap, _, 'numbers'))
					.value(),
				devicesPerUserId = _
					.chain(data.devices)
					.groupBy('owner_id')
					.mapValues(_.partial(_.map, _, formatDevice))
					.value(),
				augmentUserExtras = _.partial(function(numbersPerUserId, devicesPerUserId, user) {
					return _.merge({}, user, {
						extra: _.merge(
							getNumbersExtra(_.get(numbersPerUserId, user.id), user.extra),
							getDevicesExtra(_.get(devicesPerUserId, user.id))
						)
					});
				}, numbersPerUserId, devicesPerUserId);

			return {
				countUsers: _.size(data.users),
				existingExtensions: _
					.chain(usableCallflows)
					.flatMap('numbers')
					.filter(function(string) {
						return string && _.size(string) < 7;
					})
					.sort(self.usersSortExtensions)
					.value(),
				showLicensedUserRoles: !_.isEmpty(self.appFlags.global.servicePlansRole),
				users: _
					.chain(data.users)
					.map(_.flow(
						formatUser,
						augmentUserExtras
					))
					.sortBy(userSort)
					.value()
			};
		},

		/* Automatically sorts an array of objects. secondArg can either be a custom sort to be applied to the dataset, or a fieldName to sort alphabetically on */
		sort: function(dataSet, secondArg) {
			var fieldName = 'name',
				sortFunction = function(a, b) {
					var aString = a[fieldName].toLowerCase(),
						bString = b[fieldName].toLowerCase(),
						result = (aString > bString) ? 1 : (aString < bString) ? -1 : 0;

					return result;
				},
				result;

			if (typeof secondArg === 'function') {
				sortFunction = secondArg;
			} else if (typeof secondArg === 'string') {
				fieldName = secondArg;
			}

			result = dataSet.sort(sortFunction);

			return result;
		},

		usersBindEvents: function(template, parent, data) {
			var self = this,
				currentUser,
				currentCallflow,
				existingExtensions = data.existingExtensions,
				extensionsToSave,
				numbersToSave,
				extraSpareNumbers,
				unassignedDevices,
				toastrMessages = self.i18n.active().users.toastrMessages,
				listUsers = data,
				renderFindMeFollowMeFeature = function(featureCallback) {
					monster.parallel({
						userDevices: function(callback) {
							self.usersListDeviceUser(currentUser.id, function(devices) {
								callback(null, devices);
							});
						},
						userCallflow: function(callback) {
							self.usersGetMainCallflow(currentUser.id, function(callflow) {
								callback(null, callflow);
							});
						}
					}, function(error, results) {
						self.usersRenderFindMeFollowMe($.extend(true, results, { currentUser: currentUser, saveCallback: featureCallback }));
					});
				},
				isExtension = function(input) {
					return _
						.chain(input)
						.toString()
						.thru(function(string) {
							return /\d/.test(string);
						})
						.value();
				};

			setTimeout(function() { template.find('.search-query').focus(); });

			template.find('.grid-row.title .grid-cell.name').on('click', function() {
				self.usersRender({ sortBy: 'first_name' });
			});

			template.find('.grid-row.title .grid-cell.extension').on('click', function() {
				self.usersRender({ sortBy: 'presence_id' });
			});

			template.find('.grid-row:not(.title) .grid-cell').on('click', function() {
				var cell = $(this),
					type = cell.data('type'),
					row = cell.parents('.grid-row'),
					userId = row.data('id');

				template.find('.edit-user').slideUp('400', function() {
					$(this).empty();
				});

				if (cell.hasClass('active')) {
					template.find('.grid-cell').removeClass('active');
					template.find('.grid-row').removeClass('active');

					self.overlayRemove();
					cell.css({
						'position': 'initial',
						'z-index': '0'
					});

					cell.parent().siblings('.edit-user').css({
						'position': 'initial',
						'z-index': '0',
						'border-top-color': '#a6a7a9'
					});
				} else {
					template.find('.grid-cell').removeClass('active');
					template.find('.grid-row').removeClass('active');
					cell.toggleClass('active');
					row.toggleClass('active');

					cell.css({
						'position': 'relative',
						'z-index': '2'
					});

					cell.parent().siblings('.edit-user').css({
						'position': 'relative',
						'z-index': '2',
						'border-top-color': 'transparent'
					});

					self.usersGetTemplate(type, userId, listUsers, function(template, data) {
						if (type === 'name') {
							currentUser = data;

							if (monster.util.isFeatureAvailable('smartpbx.users.timezone.edit')) {
								monster.ui.chosen(template.find('#user_timezone'));
							}

							data.extra.differentEmail ? template.find('.email-group').show() : template.find('.email-group').hide();
						} else if (type === 'numbers') {
							extensionsToSave = [];
							extraSpareNumbers = [];
							currentCallflow = data.callflow;
							currentUser = data.user;

							monster.ui.tooltips(template);

							_.each(data.extensions, function(number) {
								extensionsToSave.push(number);
							});
						} else if (type === 'extensions') {
							existingExtensions = data.allExtensions;
							currentCallflow = data.callflow;
							currentUser = data.user;
							numbersToSave = [];

							_.each(data.assignedNumbers, function(v) {
								numbersToSave.push(v.phoneNumber);
							});
						} else if (type === 'features') {
							currentUser = data;
						} else if (type === 'devices') {
							setTimeout(function() { template.find('.search-query').focus(); });
							currentUser = userId;
							unassignedDevices = {};
						} else if (type === 'licensed-user-role') {
							currentUser = data;
						}

						row.find('.edit-user').append(template).slideDown(400, function() {
							$('body').animate({ scrollTop: row.offset().top - (window.innerHeight - row.height() - 10) });
						});

						self.overlayInsert();
					});
				}
			});

			template.find('.users-header .search-query').on('keyup', function() {
				var searchString = $(this).val().toLowerCase(),
					rows = template.find('.user-rows .grid-row:not(.title)'),
					emptySearch = template.find('.user-rows .empty-search-row');

				_.each(rows, function(row) {
					var row = $(row);

					row.data('search').toLowerCase().indexOf(searchString) < 0 ? row.hide() : row.show();
				});

				if (rows.size() > 0) {
					rows.is(':visible') ? emptySearch.hide() : emptySearch.show();
				}
			});

			template.find('.users-header .add-user').on('click', function() {
				self.usersRenderAddModalDialog();
			});

			template.on('click', '.cancel-link', function() {
				template.find('.edit-user').slideUp('400', function() {
					$(this).empty();
					template.find('.grid-cell.active').css({
						'position': 'inline-block',
						'z-index': '0'
					});
					template.find('.grid-row.active .edit-user').css({
						'position': 'block',
						'z-index': '0'
					});
					template.find('.grid-row.active').removeClass('active');

					self.overlayRemove();

					template.find('.grid-cell.active').removeClass('active');
				});
			});

			/* Events for Extensions details */
			template.on('click', '.save-extensions', function() {
				var $this = $(this),
					numbers = $.extend(true, [], numbersToSave),
					name = $this.parents('.grid-row').find('.grid-cell.name').text(),
					userId = $this.parents('.grid-row').data('id'),
					extensionsList = [];

				template.find('.extensions .list-assigned-items .item-row').each(function(k, row) {
					var row = $(row),
						number;

					number = (row.data('id') ? row.data('id') : row.find('.input-extension').val()) + '';

					numbers.push(number);
					extensionsList.push(number);
				});

				if (numbers.length > 0) {
					var updateCallflow = function() {
						self.usersUpdateCallflowNumbers(userId, (currentCallflow || {}).id, numbers, function(callflowData) {
							monster.ui.toast({
								type: 'success',
								message: self.getTemplate({
									name: '!' + toastrMessages.numbersUpdated,
									data: {
										name: name
									}
								})
							});

							self.usersRender({ userId: callflowData.owner_id });
						});
					};

					if (self.usersHasProperPresenceId(extensionsList, currentUser)) {
						updateCallflow();
					} else {
						var oldPresenceId = currentUser.presence_id;
						self.usersUpdatePresenceIDPopup(extensionsList, currentUser, function(user) {
							// Update the user and the vmbox with the new presence_id / main number
							self.usersUpdateUser(user, function() {
								self.usersSmartUpdateVMBox({
									user: user,
									callback: function() {
										updateCallflow();
									},
									oldPresenceId: oldPresenceId
								});
							});
						});
					}
				} else {
					monster.ui.alert('warning', self.i18n.active().users.noNumberCallflow);
				}
			});

			template.on('click', '#add_extensions', function() {
				var nextExtension = parseInt(monster.util.getNextExtension(existingExtensions)) + '',
					dataTemplate = {
						recommendedExtension: nextExtension
					},
					newLineTemplate = $(self.getTemplate({
						name: 'newExtension',
						data: dataTemplate,
						submodule: 'users'
					})),
					listExtensions = template.find('.extensions .list-assigned-items');

				monster.ui.mask(newLineTemplate.find('.input-extension '), 'extension');

				listExtensions.find('.empty-row').hide();

				listExtensions.append(newLineTemplate);

				existingExtensions.push(nextExtension);
			});

			template.on('click', '.remove-extension', function() {
				var phoneRow = $(this).parents('.item-row'),
					emptyRow = phoneRow.siblings('.empty-row');

				phoneRow.slideUp(function() {
					phoneRow.remove();

					if (!template.find('.list-assigned-items .item-row').is(':visible')) {
						emptyRow.slideDown();
					}
				});
			});

			template.on('click', '.cancel-extension-link', function() {
				var extension = $(this).siblings('input').val(),
					index = existingExtensions.indexOf(extension);

				if (index > -1) {
					existingExtensions.splice(index, 1);
				}

				$(this).parents('.item-row').remove();
			});

			template.on('click', '#impersonate_user', function() {
				var dataUser = $(this).parents('.grid-row').data();

				monster.pub('auth.triggerImpersonateUser', {
					userId: dataUser.id,
					userName: dataUser.name
				});
			});

			template.on('click', '#delete_user', function() {
				var dataUser = $(this).parents('.grid-row').data();

				monster.pub('common.deleteSmartUser.renderPopup', {
					user: dataUser,
					callback: function(data) {
						monster.ui.toast({
							type: 'success',
							message: self.getTemplate({
								name: '!' + self.i18n.active().users.toastrMessages.userDelete,
								data: {
									name: data.first_name + ' ' + data.last_name
								}
							})
						});
						self.usersRender();
					}
				});
			});

			template.on('change', '#notification_email', function() {
				if (template.find('.email-border').hasClass('open')) {
					template.find('.email-border').removeClass('open', 400);
					template.find('.email-group').slideUp();
				} else {
					template.find('.email-group').slideDown();
					template.find('.email-border').addClass('open', 400);
				}
			});

			template.on('click', '.save-user', function() {
				var formData = monster.ui.getFormData('form-' + currentUser.id),
					form = template.find('#form-' + currentUser.id);

				monster.util.checkVersion(currentUser, function() {
					if (monster.ui.valid(form)) {
						var oldPresenceId = currentUser.presence_id,
							userToSave = $.extend(true, {}, currentUser, formData),
							newName = monster.util.getUserFullName(userToSave),
							oldName = monster.util.getUserFullName(currentUser),
							isUserNameDifferent = newName !== oldName,
							hasTimeout = userToSave.extra.ringingTimeout && userToSave.extra.features.indexOf('find_me_follow_me') < 0,
							shouldUpdateTimeout = hasTimeout ? parseInt(currentUser.extra.ringingTimeout) !== parseInt(userToSave.extra.ringingTimeout) : false;

						monster.parallel({
							vmbox: function(callback) {
								self.usersSmartUpdateVMBox({
									user: userToSave,
									callback: function(vmbox) {
										callback(null, vmbox);
									},
									oldPresenceId: oldPresenceId
								});
							},
							user: function(callback) {
								self.usersUpdateUser(userToSave, function(userData) {
									callback(null, userData.data);
								});
							},
							conference: function(callback) {
								if (isUserNameDifferent) {
									self.usersListConferences(userToSave.id, function(conferences) {
										if (conferences.length > 0) {
											var conferenceIDToChange;

											_.each(conferences, function(conference) {
												if (!conferenceIDToChange && conference.name.indexOf(self.appFlags.users.smartPBXConferenceString) >= 0) {
													conferenceIDToChange = conference.id;
												}
											});

											if (conferenceIDToChange) {
												self.usersGetConference(conferenceIDToChange, function(conference) {
													conference.name = newName + self.appFlags.users.smartPBXConferenceString;

													self.usersUpdateConference(conference, function(newConference) {
														callback && callback(null, newConference);
													});
												});
											} else {
												callback && callback(null, {});
											}
										} else {
											callback && callback(null, {});
										}
									});
								} else {
									callback && callback(null, {});
								}
							},
							callflow: function(callback) {
								if (!isUserNameDifferent && !shouldUpdateTimeout) {
									callback(null, null);
									return;
								}

								monster.waterfall([
									function(waterfallCallback) {
										self.usersGetMainCallflow(userToSave.id, function(mainCallflow) {
											waterfallCallback(null, mainCallflow);
										});
									},
									function(mainCallflow, waterfallCallback) {
										if (_.isNil(mainCallflow)) {
											waterfallCallback(null, null);
											return;
										}

										if (isUserNameDifferent) {
											mainCallflow.name = newName + self.appFlags.users.smartPBXCallflowString;
										}

										if (shouldUpdateTimeout && 'flow' in mainCallflow) {
											var flow = mainCallflow.flow;
											while (flow.module !== 'user' && '_' in flow.children) {
												flow = flow.children._;
											}
											flow.data.timeout = parseInt(userToSave.extra.ringingTimeout);
										}

										self.usersUpdateCallflow(mainCallflow, function(updatedCallflow) {
											callback(null, updatedCallflow);
										});
									}
								], callback);
							}
						}, function(error, results) {
							monster.ui.toast({
								type: 'success',
								message: self.getTemplate({
									name: '!' + toastrMessages.userUpdated,
									data: {
										name: monster.util.getUserFullName(results.user)
									}
								})
							});

							self.usersRender({ userId: results.user.id });
						});
					}
				});
			});

			template.on('click', '#change_pin', function() {
				var pinTemplate = $(self.getTemplate({
						name: 'changePin',
						submodule: 'users'
					})),
					form = pinTemplate.find('#form_new_pin');

				//monster.ui.validate(form);

				monster.ui.validate(form, {
					rules: {
						'pin': {
							number: true,
							minlength: 4,
							min: 0
						}
					}
				});

				pinTemplate.find('.save-new-pin').on('click', function() {
					var formData = monster.ui.getFormData('form_new_pin');

					if (monster.ui.valid(form)) {
						self.usersPatchVMBox({
							data: {
								voicemailId: currentUser.extra.vmbox.id,
								data: formData
							},
							success: function(data) {
								popup.dialog('close').remove();

								monster.ui.toast({
									type: 'success',
									message: self.getTemplate({
										name: '!' + toastrMessages.pinUpdated,
										data: {
											name: monster.util.getUserFullName(currentUser)
										}
									})
								});
							}
						});
					}
				});

				pinTemplate.find('.cancel-link').on('click', function() {
					popup.dialog('close').remove();
				});

				var popup = monster.ui.dialog(pinTemplate, {
					title: self.i18n.active().users.dialogChangePin.title
				});
			});

			template.on('click', '#change_username', function() {
				var passwordTemplate = $(self.getTemplate({
						name: 'changePassword',
						data: currentUser,
						submodule: 'users'
					})),
					form = passwordTemplate.find('#form_new_username');

				monster.ui.showPasswordStrength(passwordTemplate.find('#inputPassword'));

				monster.ui.validate(form, {
					rules: {
						username: {
							required: true
						},
						password: {
							required: true,
							minlength: 6
						},
						confirm_password: {
							required: true,
							equalTo: '#inputPassword'
						}
					}
				});

				passwordTemplate.find('.reset-password').on('click', function() {
					var dataReset = {
						username: currentUser.username,
						account_name: monster.apps.auth.currentAccount.name
					};

					self.usersResetPassword(dataReset, function() {
						popup.dialog('close').remove();

						monster.ui.toast({
							type: 'success',
							message: self.getTemplate({
								name: '!' + toastrMessages.successResetPassword,
								data: {
									name: dataReset.username
								}
							})
						});
					});
				});

				passwordTemplate.find('.save-new-username').on('click', function() {
					var $saveButton = $(this),
						formData = monster.ui.getFormData('form_new_username'),
						userToSave = $.extend(true, {}, currentUser, formData);

					if (monster.ui.valid(form)) {
						$saveButton
							.prop('disabled', true);

						if (!currentUser.extra.differentEmail) {
							userToSave.email = userToSave.username;
						}

						self.usersUpdateUser(userToSave, function(userData) {
							currentUser.username = userData.data.username;
							template.find('#username').html(userData.data.username);

							if (!currentUser.extra.differentEmail) {
								template.find('#email').val(userData.data.email);
								currentUser.email = userData.username;
							}

							popup.dialog('close').remove();

							monster.ui.toast({
								type: 'success',
								message: self.getTemplate({
									name: '!' + toastrMessages.userUpdated,
									data: {
										name: monster.util.getUserFullName(userData.data)
									}
								})
							});
						});
					}
				});

				passwordTemplate.find('.cancel-link').on('click', function() {
					popup.dialog('close').remove();
				});

				var popup = monster.ui.dialog(passwordTemplate, {
					title: self.i18n.active().users.dialogChangePassword.title
				});
			});

			template.on('click', '#open_fmfm_link', function() {
				renderFindMeFollowMeFeature(function(usersRenderArgs) {
					usersRenderArgs.openedTab = 'name';
					self.usersRender(usersRenderArgs);
				});
			});

			template.on('focus', '.ringing-timeout.disabled #ringing_timeout', function() {
				$(this).blur();
			});

			template.on('change', '#licensed_role', function(event) {
				event.preventDefault();

				var planId = $(this).val();

				if (!currentUser.hasOwnProperty('service')
					|| planId !== Object.keys(currentUser.service.plans)[0]) {
					template
						.find('.save-user-role')
							.prop('disabled', false);
				} else {
					template
						.find('.save-user-role')
							.prop('disabled', true);
				}
			});

			/* Events for License Roles */
			template.on('click', '.save-user-role', function() {
				var planId = template.find('#licensed_role').val();

				currentUser.extra = currentUser.extra || {};
				currentUser.extra.licensedRole = planId;

				self.usersUpdateUser(currentUser, function(userData) {
					monster.ui.toast({
						type: 'success',
						message: self.getTemplate({
							name: '!' + toastrMessages.userUpdated,
							data: {
								name: monster.util.getUserFullName(userData.data)
							}
						})
					});
					self.usersRender({ userId: userData.data.id });
				});
			});

			/* Events for Devices in Users */
			template.on('click', '.create-device', function() {
				var $this = $(this),
					type = $this.data('type');

				monster.pub('voip.devices.renderAdd', {
					allowAssign: false,
					type: type,
					callback: function(device) {
						var rowDevice = $(self.getTemplate({
								name: 'rowSpareDevice',
								data: device,
								submodule: 'users'
							})),
							listAssigned = template.find('.list-assigned-items');

						listAssigned.find('.empty-row').hide();
						listAssigned.append(rowDevice);
					}
				});
			});

			template.on('click', '.spare-devices:not(.disabled)', function() {
				var currentlySelected = $.map(template.find('.device-list.list-assigned-items .item-row'), function(val) { return $(val).data('id'); });
				self.usersGetDevicesData(function(devicesData) {
					var spareDevices = {};
					_.each(devicesData, function(device) {
						if ((!('owner_id' in device) || device.owner_id === '' || device.owner_id === currentUser) && currentlySelected.indexOf(device.id) === -1) {
							spareDevices[device.id] = device;
						}
					});

					monster.pub('common.monsterListing.render', {
						dataList: spareDevices,
						dataType: 'devices',
						okCallback: function(devices) {
							_.each(devices, function(device) {
								var rowDevice = $(self.getTemplate({
										name: 'rowSpareDevice',
										data: device,
										submodule: 'users'
									})),
									listAssigned = template.find('.list-assigned-items');

								listAssigned.find('.empty-row').hide();
								listAssigned.append(rowDevice);

								if (device.owner_id) {
									delete unassignedDevices[device.id];
								}
							});
						}
					});
				});
			});

			template.on('click', '.save-devices', function() {
				var dataDevices = {
						newDevices: [],
						oldDevices: []
					},
					name = $(this).parents('.grid-row').find('.grid-cell.name').text(),
					userId = $(this).parents('.grid-row').data('id');

				template.find('.detail-devices .list-assigned-items .item-row:not(.assigned)').each(function(k, row) {
					dataDevices.newDevices.push($(row).data('id'));
				});
				dataDevices.oldDevices = _.keys(unassignedDevices);

				self.usersUpdateDevices(dataDevices, userId, function() {
					monster.ui.toast({
						type: 'success',
						message: self.getTemplate({
							name: '!' + toastrMessages.devicesUpdated,
							data: {
								name: name
							}
						})
					});
					self.usersRender({ userId: userId });
				});
			});

			template.on('click', '.detail-devices .edit-device-link', function() {
				var row = $(this).parents('.item-row'),
					id = row.data('id'),
					userId = $(this).parents('.grid-row').data('id'),
					userData = _.find(data.users, { id: userId }),
					deviceData = _.find(userData.extra.devices, { id: id });

				monster.pub('voip.devices.editDevice', {
					allowAssign: false,
					data: { id: id, isRegistered: deviceData.registered },
					callbackSave: function(device) {
						row.find('.edit-device').html(device.name);
					},
					callbackDelete: function(device) {
						self.usersRender({ userId: userId, openedTab: 'devices' });
					}
				});
			});

			template.on('click', '.detail-devices .list-assigned-items .remove-device', function() {
				var row = $(this).parents('.item-row'),
					userId = template.find('.grid-row.active').data('id'),
					deviceId = row.data('id'),
					userData = _.find(data.users, function(user) { return user.id === userId; }),
					deviceData = _.find(userData.extra.devices, function(device) { return device.id === deviceId; }),
					removeDevice = function() {
						if (row.hasClass('assigned')) {
							unassignedDevices[row.data('id')] = true;
						}
						row.remove();
						var rows = template.find('.detail-devices .list-assigned-items .item-row');
						if (rows.is(':visible') === false) {
							template.find('.detail-devices .list-assigned-items .empty-row').show();
						}
					};

				if (deviceData && deviceData.type === 'mobile') {
					monster.ui.confirm(
						self.i18n.active().users.confirmMobileUnAssignment.replace(
							'{{variable}}',
							monster.util.formatPhoneNumber(deviceData.mobile.mdn)
						),
						removeDevice
					);
				} else {
					removeDevice();
				}
			});

			/* Events for Numbers in Users */
			template.on('click', '.detail-numbers .list-assigned-items .remove-number', function() {
				var $this = $(this),
					row = $this.parents('.item-row');

				if (row.data('type') !== 'mobile') {
					extraSpareNumbers.push(row.data('id'));

					row.slideUp(function() {
						row.remove();

						if (!template.find('.list-assigned-items .item-row').is(':visible')) {
							template.find('.list-assigned-items .empty-row').slideDown();
						}

						template.find('.spare-link').removeClass('disabled');
					});
				}
			});

			template.on('click', '.actions .spare-link:not(.disabled)', function(e) {
				e.preventDefault();

				var args = {
					accountName: monster.apps.auth.currentAccount.name,
					accountId: self.accountId,
					ignoreNumbers: $.map(template.find('.item-row'), function(row) {
						return $(row).data('id');
					}),
					extraNumbers: extraSpareNumbers,
					callback: function(numberList, remainingQuantity) {
						template.find('.empty-row').hide();

						_.each(numberList, function(val) {
							template
								.find('.list-assigned-items')
								.append($(self.getTemplate({
									name: 'numbersItemRow',
									data: {
										number: val
									},
									submodule: 'users'
								})));

							var numberDiv = template.find('[data-id="' + val.phoneNumber + '"]'),
								args = {
									target: numberDiv.find('.edit-features'),
									numberData: val,
									afterUpdate: function(features) {
										monster.ui.paintNumberFeaturesIcon(features, numberDiv.find('.features'));
									}
								};

							monster.pub('common.numberFeaturesMenu.render', args);

							extraSpareNumbers = _.without(extraSpareNumbers, val.phoneNumber);
						});

						monster.ui.tooltips(template);

						if (remainingQuantity === 0) {
							template.find('.spare-link').addClass('disabled');
						}
					}
				};

				monster.pub('common.numbers.dialogSpare', args);
			});

			template.on('click', '.actions .buy-link', function(e) {
				e.preventDefault();

				monster.pub('common.buyNumbers', {
					searchType: $(this).data('type'),
					callbacks: {
						success: function(numbers) {
							_.each(numbers, function(number) {
								number.phoneNumber = number.id;

								var rowTemplate = $(self.getTemplate({
										name: 'numbersItemRow',
										data: {
											number: number
										},
										submodule: 'users'
									})),
									argsFeatures = {
										target: rowTemplate.find('.edit-features'),
										numberData: number,
										afterUpdate: function(features) {
											monster.ui.paintNumberFeaturesIcon(features, rowTemplate.find('.features'));
										}
									};

								monster.pub('common.numberFeaturesMenu.render', argsFeatures);

								monster.ui.tooltips(rowTemplate);

								template.find('.list-assigned-items .empty-row').hide();
								template.find('.list-assigned-items').append(rowTemplate);
							});
						}
					}
				});
			});

			template.on('click', '.save-numbers', function() {
				var $this = $(this),
					dataNumbers = $.extend(true, [], extensionsToSave),
					name = $this.parents('.grid-row').find('.grid-cell.name').text(),
					userId = $this.parents('.grid-row').data('id');

				template.find('.item-row').each(function(k, row) {
					var row = $(row),
						number = row.data('id'),
						type = row.data('type');

					if (type !== 'mobile') {
						dataNumbers.push(number);
					}
				});

				if (dataNumbers.length > 0) {
					self.usersUpdateCallflowNumbers(userId, (currentCallflow || {}).id, dataNumbers, function(callflowData) {
						var afterUpdate = function() {
							monster.ui.toast({
								type: 'success',
								message: self.getTemplate({
									name: '!' + toastrMessages.numbersUpdated,
									data: {
										name: name
									}
								})
							});

							self.usersRender({ userId: callflowData.owner_id });
						};

						// If the User has the External Caller ID Number setup to a number that is no longer assigned to this user, then remove the Caller-ID Feature
						if (currentUser.caller_id.hasOwnProperty('external')
						&& currentUser.caller_id.external.hasOwnProperty('number')
						&& callflowData.numbers.indexOf(currentUser.caller_id.external.number) < 0) {
							delete currentUser.caller_id.external.number;

							self.usersUpdateUser(currentUser, function() {
								afterUpdate();

								monster.ui.toast({
									type: 'info',
									message: toastrMessages.callerIDDeleted
								});
							});
						} else {
							afterUpdate();
						}
					});
				} else {
					monster.ui.alert('warning', self.i18n.active().users.noNumberCallflow);
				}
			});

			template.on('click', '.feature[data-feature="caller_id"]', function() {
				if (monster.config.whitelabel && monster.config.whitelabel.allowAnyOwnedNumberAsCallerID) {
					self.usersListNumbers(function(accountNumbers) {
						var numberChoices = accountNumbers.numbers,
							phoneNumber;
						for (phoneNumber in numberChoices) {
							numberChoices[monster.util.formatPhoneNumber(phoneNumber)] = $.extend(true, {}, numberChoices[phoneNumber]);
							if (phoneNumber !== monster.util.formatPhoneNumber(phoneNumber)) {
								delete numberChoices[phoneNumber];
							}
						}
						if (currentUser.caller_id && currentUser.caller_id.external && currentUser.caller_id.external.number) {
							currentUser.caller_id.external.number = monster.util.formatPhoneNumber(currentUser.caller_id.external.number);
						}
						self.usersRenderCallerId(currentUser, numberChoices);
					});
				} else {
					self.usersRenderCallerId(currentUser);
				}
			});

			template.on('click', '.feature[data-feature="do_not_disturb"]', function() {
				self.usersRenderDoNotDisturb(currentUser);
			});

			template.on('click', '.feature[data-feature="call_forward"]', function() {
				if (currentUser.extra.features.indexOf('find_me_follow_me') < 0) {
					var featureUser = $.extend(true, {}, currentUser);
					self.usersGetMainCallflow(featureUser.id, function(mainCallflow) {
						if (mainCallflow && 'flow' in mainCallflow) {
							var flow = mainCallflow.flow;
							while (flow.module !== 'user' && '_' in flow.children) {
								flow = flow.children._;
							}
							if (flow.data.timeout < 30) {
								featureUser.extra.timeoutTooShort = true;
							}
						}
						self.usersRenderCallForward(featureUser);
					});
				} else {
					self.usersRenderCallForward(currentUser);
				}
			});

			template.on('click', '.feature[data-feature="hotdesk"]', function() {
				self.usersRenderHotdesk(currentUser);
			});

			template.on('click', '.feature[data-feature="find_me_follow_me"]', function() {
				renderFindMeFollowMeFeature();
			});

			template.on('click', '.feature[data-feature="call_recording"]', function() {
				self.usersGetCallRecordingData(currentUser.id, function(data) {
					self.usersRenderCallRecording({
						hasStorageConfigured: data.hasStorageConfigured,
						userCallflow: data.callflow,
						currentUser: currentUser
					});
				});
			});

			template.on('click', '.feature[data-feature="music_on_hold"]', function() {
				self.usersRenderMusicOnHold(currentUser);
			});

			template.on('click', '.feature[data-feature="vmbox"]', function() {
				self.usersGetMainCallflowAndVMBox({
					userId: currentUser.id,
					success: function(data) {
						var vmbox = data.vmbox,
							vmboxModule = self.usersExtractDataFromCallflow({
								callflow: data.callflow,
								module: 'voicemail'
							}),
							isMissingExtension = _
								.chain(data)
								.get('callflow.numbers')
								.find(isExtension)
								.isUndefined()
								.value();

						if (isMissingExtension) {
							return monster.ui.alert('warning', self.i18n.active().users.vmbox.missingExtension);
						}

						// Update in-memory vmbox status
						currentUser.extra.mapFeatures.vmbox.active = !(_.isUndefined(vmboxModule) || _.get(vmboxModule, 'data.skip_module', false));

						currentUser.extra.deleteAfterNotify = (vmbox && vmbox.delete_after_notify);

						self.usersRenderVMBox(currentUser, vmbox);
					}
				});
			});

			template.on('click', '.feature[data-feature="conferencing"]', function() {
				self.usersGetConferenceFeature(currentUser.id, function(dataConf) {
					var data = {
						listConferences: dataConf.listConfNumbers,
						user: currentUser,
						conference: dataConf.conference
					};

					if (_.isEmpty(data.listConferences)) {
						monster.ui.alert('error', self.i18n.active().users.conferencing.noConfNumbers);
					} else {
						self.usersRenderConferencing(data);
					}
				});
			});

			template.on('click', '.feature[data-feature="faxing"]', function() {
				if (!monster.util.isTrial()) {
					monster.parallel({
						numbers: function(callback) {
							self.usersListNumbers(function(listNumbers) {
								var spareNumbers = {};

								_.each(listNumbers.numbers, function(number, key) {
									if (!number.hasOwnProperty('used_by') || number.used_by === '') {
										spareNumbers[key] = number;
									}
								});

								callback && callback(null, spareNumbers);
							});
						},
						callflows: function(callback) {
							self.usersListCallflowsUser(currentUser.id, function(callflows) {
								var existingCallflow;

								_.each(callflows, function(callflow) {
									if (callflow.type === 'faxing') {
										existingCallflow = callflow;

										return false;
									}
								});

								if (existingCallflow) {
									self.callApi({
										resource: 'callflow.get',
										data: {
											accountId: self.accountId,
											callflowId: existingCallflow.id
										},
										success: function(data, status) {
											callback && callback(null, data.data);
										}
									});
								} else {
									callback && callback(null, existingCallflow);
								}
							});
						},
						account: function(callback) {
							self.callApi({
								resource: 'account.get',
								data: {
									accountId: self.accountId
								},
								success: function(data, status) {
									callback(null, data.data);
								}
							});
						}
					}, function(err, results) {
						results.user = currentUser;

						if (typeof results.callflows !== 'undefined') {
							// Compatibility with old version
							var faxboxId = results.callflows.flow.data.hasOwnProperty('faxbox_id') ? results.callflows.flow.data.faxbox_id : results.callflows.flow.data.id;

							self.callApi({
								resource: 'faxbox.get',
								data: {
									accountId: self.accountId,
									faxboxId: faxboxId
								},
								success: function(_data) {
									results.faxbox = _data.data;

									results.faxbox.id = faxboxId;

									self.usersRenderFaxboxes(results);
								},
								error: function() {
									self.usersRenderFaxboxes(results);
								}
							});
						} else {
							self.usersRenderFaxboxes(results);
						}
					});
				} else {
					monster.ui.alert('warning', self.i18n.active().users.faxing.trialError);
				}
			});

			self.overlayBindOnClick(template, 'user');
		},

		usersBindAddUserEvents: function(args) {
			var self = this,
				template = args.template,
				data = args.data,
				popup = args.popup;

			template.find('.create_user').on('click', function() {
				if (!monster.ui.valid(template.find('#form_user_creation'))) {
					return;
				}

				var action = $(this).data('action'),
					$buttons = template.find('.create_user'),
					dataForm = _.merge(monster.ui.getFormData('form_user_creation'), {
						user: {
							device: {
								family: template.find('#device_model').find(':selected').data('family')
							}
						}
					}),
					formattedData = self.usersFormatCreationData(dataForm);

				$buttons.prop('disabled', true);

				self.usersCreate({
					data: formattedData,
					success: function(data) {
						popup.dialog('close').remove();

						switch (action) {
							case 'add_new':
								self.usersRender();
								self.usersRenderAddModalDialog();
								break;
							default:
								self.usersRender({ userId: data.user.id });
								break;
						}
					},
					error: function() {
						$buttons.prop('disabled', false);
					}
				});
			});

			template.find('#notification_email').on('change', function() {
				template.find('.email-group').toggleClass('hidden');
			});

			template.find('#device_brand').on('change', function() {
				var brand = $(this).val(),
					selectedBrand = [],
					$deviceModel = template.find('.device-model'),
					$deviceName = template.find('.device-name'),
					$deviceMac = template.find('.device-mac'),
					$deviceModelSelect = template.find('#device_model');

				if (brand !== 'none') {
					self.usersDeviceFormReset(template);
					$deviceModel.slideDown();
					$deviceName.slideDown();
					$deviceMac.slideDown();

					selectedBrand = _.find(data.listProvisioners, function(provisioner) {
						return provisioner.name === brand;
					});

					$deviceModelSelect
						.find('option')
						.remove()
						.end();

					selectedBrand.models.map(function(model) {
						var option = $('<option>', {
							value: model.name,
							text: model.name
						}).attr('data-family', model.family);

						$deviceModelSelect.append(option);
					});

					$deviceModelSelect.trigger('chosen:updated');

					return;
				}

				self.usersDeviceFormReset(template);
			});
		},

		usersRenderAddModalDialog: function() {
			var self = this;

			monster.parallel({
				callflows: function(callback) {
					self.usersListCallflows(function(callflows) {
						callback(null, callflows);
					});
				},
				vmboxes: function(callback) {
					self.usersListVMBoxes({
						success: function(vmboxes) {
							callback(null, vmboxes);
						}
					});
				},
				provisioners: function(callback) {
					if (!self.appFlags.common.hasProvisioner) {
						callback(null);
						return;
					}

					monster.request({
						resource: 'common.chooseModel.getProvisionerData',
						data: {
							generateError: false
						},
						success: function(provisionerData) {
							callback(null, provisionerData.data);
						},
						error: function() {
							callback(null, {});
						}
					});
				}
			}, function(err, results) {
				var originalData = self.usersFormatAddUser(results),
					userTemplate = $(self.getTemplate({
						name: 'creation',
						data: originalData,
						submodule: 'users'
					})),
					userCreationForm = userTemplate.find('#form_user_creation'),
					validationOptions = {
						ignore: ':hidden:not(select)',
						rules: {
							'callflow.extension': {
								checkList: originalData.listExtensions
							},
							'vmbox.number': {
								checkList: originalData.listVMBoxes
							},
							'user.password': {
								minlength: 6
							},
							'user.device.name': 'required',
							'user.device.model': 'required',
							'user.device.mac_address': {
								required: true,
								mac: true
							}
						},
						messages: {
							'user.first_name': {
								required: self.i18n.active().validation.required
							},
							'user.last_name': {
								required: self.i18n.active().validation.required
							},
							'callflow.extension': {
								required: self.i18n.active().validation.required
							},
							'user.device.model': {
								required: self.i18n.active().validation.required
							},
							'user.device.name': {
								required: self.i18n.active().validation.required
							},
							'user.device.mac_address': {
								required: self.i18n.active().validation.required
							}
						}
					};

				if (originalData.licensedUserRoles) {
					validationOptions.rules['user.extra.licensedRole'] = {
						checkList: [ 'none' ]
					};
					validationOptions.messages['user.extra.licensedRole'] = {
						checkList: self.i18n.active().validation.required
					};
				}

				monster.ui.mask(userTemplate.find('#extension'), 'extension');
				monster.ui.chosen(userTemplate.find('#licensed_role'));
				monster.ui.mask(userTemplate.find('#mac_address'), 'macAddress');
				monster.ui.validate(userCreationForm, validationOptions);

				// Force select element validation on change event
				// (Not handled by jQuery Validation plugin because the select
				// element is hidden by the Chosen jQuery plugin. For more info, see:
				// https://github.com/jquery-validation/jquery-validation/issues/997)
				userCreationForm.find('select').on('change', function() {
					userCreationForm.validate().element(this);
				});

				monster.ui.showPasswordStrength(userTemplate.find('#password'));
				monster.ui.chosen(userTemplate.find('#device_brand'));
				monster.ui.chosen(userTemplate.find('#device_model'));

				var popup = monster.ui.dialog(userTemplate, {
					title: self.i18n.active().users.dialogCreationUser.title
				});

				self.usersBindAddUserEvents({
					template: userTemplate,
					data: originalData,
					popup: popup
				});
			});
		},

		usersDeviceFormReset: function(template) {
			var $deviceModel = template.find('.device-model'),
				$deviceName = template.find('.device-name'),
				$deviceMac = template.find('.device-mac');

			$deviceModel.slideUp();
			$deviceName.slideUp();
			$deviceMac.slideUp();
		},

		usersGetCallRecordingData: function(userId, globalCallback) {
			var self = this;

			monster.parallel({
				callflow: function(callback) {
					self.usersGetMainCallflow(userId, function(data) {
						callback && callback(null, data);
					});
				},
				hasStorageConfigured: function(callback) {
					self.usersGetStoragePlan(function(data) {
						var isConfigured = false;

						if (data && data.hasOwnProperty('plan') && data.plan.hasOwnProperty('modb') && data.plan.modb.hasOwnProperty('types') && data.plan.modb.types.hasOwnProperty('call_recording')) {
							isConfigured = true;
						}

						callback && callback(null, isConfigured);
					});
				}
			}, function(err, results) {
				globalCallback && globalCallback(results);
			});
		},

		usersGetStoragePlan: function(callback) {
			var self = this;

			self.callApi({
				resource: 'storage.get',
				data: {
					accountId: self.accountId,
					generateError: false
				},
				success: function(data) {
					callback(data.data);
				},
				error: function(data, error, globalHandler) {
					if (error.status === 404) {
						callback({});
					} else {
						globalHandler(data);
					}
				}
			});
		},

		usersUpdatePresenceIDPopup: function(numbers, user, callback) {
			var self = this,
				dataTemplate = {
					numbers: numbers
				},
				template = $(self.getTemplate({
					name: 'changePresenceIDPopup',
					data: dataTemplate,
					submodule: 'users'
				})),
				$options = template.find('.presence-id-option');

			$options.on('click', function() {
				$options.removeClass('active');
				$(this).addClass('active');
			});

			template.find('.save-presence-id').on('click', function() {
				var newPresenceID = template.find('.presence-id-option.active').data('number');

				if (newPresenceID !== 'none') {
					user.presence_id = newPresenceID + '';
				} else {
					delete user.presence_id;
				}

				popup.dialog('close').remove();

				callback && callback(user);
			});

			template.find('.cancel-link').on('click', function() {
				popup.dialog('close').remove();
			});

			var popup = monster.ui.dialog(template, {
				title: self.i18n.active().users.presenceIDPopup.title,
				position: ['center', 20]
			});
		},

		// Check if a user's presence id is one of its extensions
		usersHasProperPresenceId: function(listNumbers, user) {
			var self = this;

			if (user.presence_id) {
				var formattedPresenceID = '' + user.presence_id;

				return _.some(listNumbers, function(number) {
					return number === formattedPresenceID;
				});
			} else {
				return _.isEmpty(listNumbers);
			}
		},

		/**
		 * @param  {Object} data
		 * @param  {Array} data.callflows
		 * @param  {Array} data.provisioners
		 * @param  {Array} data.vmboxes
		 * @return {Object}
		 */
		usersFormatAddUser: function(data) {
			var self = this,
				servicePlansRole = self.appFlags.global.servicePlansRole,
				listExtensions = _.flatMap(data.callflows, function(callflow) {
					return _
						.chain(callflow.numbers)
						.filter(function(number) {
							return _.size(number) < 7;
						})
						.map(function(number) {
							return {
								callflow: callflow,
								extension: number
							};
						})
						.value();
				}),
				mapVMBoxes = _.keyBy(data.vmboxes, 'mailbox'),
				// We concat both arrays because we want to create users with the same number for the extension # and the vmbox,
				// If for some reason a vmbox number exist without an extension, we still don't want to let them set their extension number to that number.
				allNumbers = _
					.chain([
						_.map(listExtensions, 'extension'),
						_.keys(mapVMBoxes, 'mailbox')
					])
					.flatten()
					.uniq()
					.value();

			return _.merge({
				createVmbox: true,
				hasProvisioner: self.appFlags.common.hasProvisioner && !_.isEmpty(data.provisioners),
				listExtensions: _
					.chain(listExtensions)
					.keyBy('extension')
					.mapValues('callflow')
					.value(),
				listProvisioners: _
					.chain(data.provisioners)
					.map(function(brand) {
						return _.merge({
							models: _.flatMap(brand.families, function(family) {
								return _.map(family.models, function(model) {
									return _.merge({
										family: family.name
									}, model);
								});
							})
						}, _.pick(brand, [
							'id',
							'name'
						]));
					})
					.sortBy('name')
					.value(),
				listVMBoxes: mapVMBoxes,
				nextExtension: parseInt(monster.util.getNextExtension(allNumbers)) + '',
				sendToSameEmail: true
			}, !_.isEmpty(servicePlansRole) && {
				licensedUserRoles: servicePlansRole
			});
		},

		usersFormatFaxingData: function(data) {
			return _.merge({}, data, {
				extra: {
					listNumbers: _
						.chain([
							_.keys(data.numbers),
							_
								.chain(data.callflows)
								.get('numbers', [])
								.slice(0, 1)
								.value()
						])
						.flatten()
						.uniq()
						.keyBy()
						.value()
				}
			});
		},

		usersRenderConferencing: function(data) {
			var self = this,
				featureTemplate = $(self.getTemplate({
					name: 'feature-conferencing',
					data: data,
					submodule: 'users'
				})),
				switchFeature = featureTemplate.find('.switch-state'),
				featureForm = featureTemplate.find('#conferencing_form');

			monster.ui.validate(featureForm);
			monster.ui.mask(featureTemplate.find('#pin'), 'extension');

			featureTemplate.find('.cancel-link').on('click', function() {
				popup.dialog('close').remove();
			});

			switchFeature.on('change', function() {
				$(this).prop('checked') ? featureTemplate.find('.content').slideDown() : featureTemplate.find('.content').slideUp();
			});

			featureTemplate.find('.save').on('click', function() {
				var args = {
					openedTab: 'features',
					callback: function() {
						popup.dialog('close').remove();
					}
				};

				if (monster.ui.valid(featureForm)) {
					if (switchFeature.prop('checked')) {
						self.usersUpdateConferencing(data, function(data) {
							args.userId = data.user.id;

							self.usersRender(args);
						});
					} else {
						self.usersDeleteConferencing(data.user.id, function() {
							args.userId = data.user.id;

							self.usersRender(args);
						});
					}
				}
			});

			var popup = monster.ui.dialog(featureTemplate, {
				title: data.user.extra.mapFeatures.conferencing.title,
				position: ['center', 20]
			});
		},

		usersRenderFaxboxes: function(data) {
			var self = this,
				data = self.usersFormatFaxingData(data),
				featureTemplate = $(self.getTemplate({
					name: 'feature-faxing',
					data: data,
					submodule: 'users'
				})),
				switchFeature = featureTemplate.find('.switch-state'),
				popup = monster.ui.dialog(featureTemplate, {
					title: data.user.extra.mapFeatures.faxing.title,
					position: ['center', 20]
				});

			switchFeature.on('change', function() {
				$(this).prop('checked') ? featureTemplate.find('.content').slideDown() : featureTemplate.find('.content').slideUp();
			});

			monster.pub('common.numberSelector.render', {
				container: featureTemplate.find('.number-select'),
				inputName: 'caller_id',
				number: data.hasOwnProperty('faxbox') ? data.faxbox.caller_id : undefined
			});

			featureTemplate.find('#helper_content').on('shown', function() {
				$(this).siblings('a').find('.text').text(self.i18n.active().users.faxing.emailToFax.help.hideHelp);
				featureTemplate.find('#destination_number').focus();
			});

			featureTemplate.find('#helper_content').on('hidden', function() {
				$(this).siblings('a').find('.text').text(self.i18n.active().users.faxing.emailToFax.help.showHelp);
				featureTemplate.find('#destination_number').val('');
				featureTemplate.find('.number-mirror').text(self.i18n.active().users.faxing.emailToFax.default);
			});

			featureTemplate.find('.cancel-link').on('click', function() {
				popup.dialog('close').remove();
			});

			featureTemplate.find('#destination_number').on('keyup', function() {
				var val = $(this).val(),
					textToMirror = val === '' ? self.i18n.active().users.faxing.emailToFax.default : val;

				featureTemplate.find('.number-mirror').text(textToMirror);
			});

			featureTemplate.find('.save').on('click', function() {
				var newNumber = featureTemplate.find('input[name="caller_id"]').val(),
					args = {
						openedTab: 'features',
						callback: function() {
							popup.dialog('close').remove();
						}
					};

				if (switchFeature.prop('checked')) {
					if (newNumber !== '') {
						self.usersUpdateFaxing(data, newNumber, function(results) {
							args.userId = results.callflow.owner_id;

							self.usersRender(args);
						});
					} else {
						monster.ui.alert('error', self.i18n.active().users.faxing.toastr.error.numberMissing);
					}
				} else {
					self.usersDeleteFaxing(data.user.id, function() {
						args.userId = data.user.id;

						self.usersRender(args);
					});
				}
			});
		},

		usersRenderHotdesk: function(currentUser) {
			var self = this,
				featureTemplate = $(self.getTemplate({
					name: 'feature-hotdesk',
					data: currentUser,
					submodule: 'users'
				})),
				switchFeature = featureTemplate.find('.switch-state'),
				requirePin = featureTemplate.find('[name="require_pin"]'),
				featureForm = featureTemplate.find('#hotdesk_form');

			monster.ui.validate(featureForm);

			featureTemplate.find('.cancel-link').on('click', function() {
				popup.dialog('close').remove();
			});

			switchFeature.on('change', function() {
				$(this).prop('checked') ? featureTemplate.find('.content').slideDown() : featureTemplate.find('.content').slideUp();
			});

			requirePin.on('change', function() {
				if (requirePin.is(':checked')) {
					featureTemplate.find('#pin')
						.removeAttr('disabled', 'disabled')
						.focus();
				} else {
					featureTemplate.find('#pin')
						.val('')
						.attr('disabled', 'disabled');
				}
			});

			featureTemplate.find('.save').on('click', function() {
				if (monster.ui.valid(featureForm)) {
					var formData = monster.ui.getFormData('hotdesk_form'),
						args = {
							openedTab: 'features',
							callback: function() {
								popup.dialog('close').remove();
							}
						},
						userToSave;

					formData.enabled = switchFeature.prop('checked');

					if (formData.require_pin === false) { delete formData.pin; }
					delete currentUser.hotdesk;

					userToSave = $.extend(true, {}, currentUser, { hotdesk: formData });

					self.usersUpdateUser(userToSave, function(data) {
						args.userId = data.data.id;

						self.usersRender(args);
					});
				}
			});

			var popup = monster.ui.dialog(featureTemplate, {
				title: currentUser.extra.mapFeatures.hotdesk.title,
				position: ['center', 20]
			});
		},

		usersRenderVMBox: function(currentUser, vmbox) {
			var self = this,
				featureData = currentUser.extra.mapFeatures.vmbox,
				vmboxActive = featureData.active,
				transcription = monster.util.getCapability('voicemail.transcription'),
				featureTemplate = $(self.getTemplate({
					name: 'feature-vmbox',
					data: _.merge({
						feature: _.pick(featureData, [
							'active',
							'icon'
						]),
						vmbox: {
							transcription: {
								isEnabled: _.get(transcription, 'isEnabled', false),
								value: _.get(vmbox, 'transcribe', transcription.defaultValue)
							},
							deleteAfterNotify: currentUser.extra.deleteAfterNotify,
							includeMessageOnNotify: _.get(vmbox, 'include_message_on_notify', true),
							vmToEmailEnabled: vmboxActive ? currentUser.vm_to_email_enabled : true
						}
					}, _.pick(currentUser, [
						'email'
					])),
					submodule: 'users'
				})),
				switchFeature = featureTemplate.find('.switch-state'),
				featureForm = featureTemplate.find('#vmbox_form'),
				switchTranscription = featureForm.find('#transcribe').parent(),
				switchVmToEmail = featureForm.find('#vm_to_email_enabled');

			if (!monster.util.isFeatureAvailable('smartpbx.users.features.vmbox.transcription')) {
				switchTranscription.addClass('disabled');
			}

			monster.ui.validate(featureForm);

			featureTemplate.find('.cancel-link').on('click', function() {
				popup.dialog('close').remove();
			});

			switchFeature.on('change', function() {
				$(this).prop('checked') ? featureTemplate.find('.content').slideDown() : featureTemplate.find('.content').slideUp();
			});

			switchVmToEmail.on('change', function() {
				$(this).prop('checked') ? featureForm.find('.extra-content').slideDown() : featureForm.find('.extra-content').slideUp();
			});

			featureTemplate.find('.save').on('click', function() {
				if (!monster.ui.valid(featureForm)) {
					return;
				}

				var enabled = switchFeature.prop('checked'),
					formData = monster.ui.getFormData('vmbox_form'),
					userId = currentUser.id,
					vmToEmailEnabled = enabled && formData.vm_to_email_enabled,
					deleteAfterNotify = vmToEmailEnabled && formData.delete_after_notify,
					transcribe = formData.transcribe,
					include_message_on_notify = formData.include_message_on_notify,
					vm_to_email_enabled = formData.include_message_on_notify;

				monster.waterfall([
					function(callback) {
						if (!vmbox && enabled) {
							self.usersAddMainVMBoxToUser({
								user: currentUser,
								deleteAfterNotify: deleteAfterNotify,
								callback: callback
							});
							return;
						}

						if (
							!vmbox
							|| (
								vmbox.delete_after_notify === deleteAfterNotify
								&& vmbox.transcribe === transcribe
								&& vmbox.include_message_on_notify === include_message_on_notify
								&& vmbox.vm_to_email_enabled === vm_to_email_enabled
							)
						) {
							callback(null);
							return;
						}

						self.usersPatchVMBox({
							data: {
								voicemailId: vmbox.id,
								data: {
									delete_after_notify: deleteAfterNotify,
									transcribe: transcribe,
									include_message_on_notify: include_message_on_notify,
									vm_to_email_enabled: vm_to_email_enabled
								}
							},
							success: function() {
								callback(null);
							},
							error: function() {
								callback(true);
							}
						});
					},
					function(callback) {
						if ((!vmbox && enabled) || (vmboxActive === enabled)) {
							// - Case 1: VMBox was created, so the main user callflow was already
							//   updated
							// - Case 2: VMBox status has not changed, so there is no need to
							//   update the main user callflow
							callback(null);
							return;
						}

						self.usersUpdateVMBoxStatusInCallflow({
							userId: userId,
							enabled: enabled,
							callback: callback
						});
					},
					function(callback) {
						if (
							vmboxActive === enabled
							&& currentUser.vm_to_email_enabled === vmToEmailEnabled
						) {
							callback(null);
							return;
						}

						self.usersPatchUser({
							data: {
								userId: userId,
								data: {
									vm_to_email_enabled: enabled ? vmToEmailEnabled : null
								}
							},
							success: function() {
								callback(null);
							},
							error: function() {
								callback(true);
							}
						});
					}
				], function(err) {
					if (err) {
						return;
					}

					self.usersRender({
						userId: userId,
						openedTab: 'features',
						callback: function() {
							popup.dialog('close').remove();
						}
					});
				});
			});

			var popup = monster.ui.dialog(featureTemplate, {
				title: featureData.title,
				position: ['center', 20]
			});
		},

		usersRenderCallerId: function(currentUser, numberChoices) {
			var self = this,
				allowAnyOwnedNumberAsCallerID = monster.config.whitelabel && monster.config.whitelabel.allowAnyOwnedNumberAsCallerID ? true : false,
				selectableNumbers = numberChoices && _.get(monster.config.whitelabel, 'allowAnyOwnedNumberAsCallerID')
					? _.keys(numberChoices)
					: _.get(currentUser, 'extra.listNumbers', []),
				initTemplate = function(cidNumbers) {
					var $template = $(self.getTemplate({
						name: 'feature-caller_id',
						data: _.merge({
							allowAnyOwnedNumberAsCallerID: allowAnyOwnedNumberAsCallerID
						}, _.pick(currentUser, [
							'caller_id',
							'extra'
						])),
						submodule: 'users'
					}));

					monster.ui.cidNumberSelector($template.find('.caller-id-select-target'), {
						allowNone: false,
						selected: _.get(currentUser, 'caller_id.external.number'),
						cidNumbers: cidNumbers,
						phoneNumbers: _.map(selectableNumbers, function(number) {
							return {
								number: number
							};
						})
					});

					bindEvents($template);

					return $template;
				},
				bindEvents = function($template) {
					var $switchFeature = $template.find('.switch-state'),
						getPopup = function($node) {
							return $node.parents('.ui-dialog-content');
						};

					$template.find('.cancel-link').on('click', function() {
						getPopup($(this)).dialog('close').remove();
					});

					$switchFeature.on('change', function() {
						$(this).prop('checked') ? $template.find('.content').slideDown() : $template.find('.content').slideUp();
					});

					$template.find('.save').on('click', function() {
						var switchCallerId = $template.find('.switch-state'),
							userToSave = $.extend(true, {}, {
								caller_id: {
									external: {}
								}
							}, currentUser),
							args = {
								openedTab: 'features',
								callback: function() {
									getPopup(switchCallerId).dialog('close').remove();
								}
							};

						if (switchCallerId.prop('checked')) {
							var callerIdValue = $template.find('.caller-id-select-target select').val();

							userToSave.caller_id.external.number = callerIdValue;
						} else if (userToSave.caller_id.hasOwnProperty('external')) {
							delete userToSave.caller_id.external.number;
						}

						self.usersUpdateUser(userToSave, function(data) {
							args.userId = data.data.id;

							self.usersRender(args);
						});
					});
				};

			if (
				_.isEmpty(currentUser.extra.listCallerId)
				&& !_.get(monster.config.whitelabel, 'allowAnyOwnedNumberAsCallerID', false)
			) {
				return monster.ui.alert('error', self.i18n.active().users.errorCallerId);
			}
			monster.waterfall([
				function(next) {
					self.callApi({
						resource: 'externalNumbers.list',
						data: {
							accountId: self.accountId
						},
						success: _.flow(
							_.partial(_.get, _, 'data'),
							_.partial(next, null)
						),
						error: _.partial(_.ary(next, 2), null, [])
					});
				}
			], function(err, cidNumbers) {
				monster.ui.dialog(initTemplate(cidNumbers), {
					title: currentUser.extra.mapFeatures.caller_id.title,
					position: ['center', 20]
				});
			});
		},

		usersFormatCallForwardData: function(user) {
			var self = this,
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

		usersRenderCallForward: function(currentUser) {
			var self = this,
				formattedCallForwardData = self.usersFormatCallForwardData(currentUser),
				featureTemplate = $(self.getTemplate({
					name: 'feature-call_forward',
					data: formattedCallForwardData,
					submodule: 'users'
				})),
				switchFeature = featureTemplate.find('.switch-state'),
				featureForm = featureTemplate.find('#call_forward_form'),
				args = {
					callback: function() {
						popup.dialog('close').remove();
					},
					openedTab: 'features'
				},
				timeoutWarningBox = featureTemplate.find('.help-box.red-box');

			monster.ui.mask(featureTemplate.find('#number'), 'phoneNumber');

			if (currentUser.hasOwnProperty('call_forward') && currentUser.call_forward.require_keypress) {
				timeoutWarningBox.hide();
			}

			monster.ui.validate(featureForm);

			featureTemplate.find('input[name="require_keypress"]').on('change', function() {
				timeoutWarningBox.toggle();
			});

			featureTemplate.find('.cancel-link').on('click', function() {
				popup.dialog('close').remove();
			});

			featureTemplate.find('.feature-select-mode button').on('click', function() {
				var $this = $(this);

				featureTemplate.find('.feature-select-mode button').removeClass('selected monster-button-primary');
				$(this).addClass('selected monster-button-primary');

				$this.data('value') === 'off' ? featureTemplate.find('.content').slideUp() : featureTemplate.find('.content').slideDown();
				$this.data('value') === 'failover' ? featureTemplate.find('.failover-info').slideDown() : featureTemplate.find('.failover-info').slideUp();
			});

			switchFeature.on('change', function() {
				$(this).prop('checked') ? featureTemplate.find('.content').slideDown() : featureTemplate.find('.content').slideUp();
			});

			featureTemplate.find('.save').on('click', function() {
				var formData = monster.ui.getFormData('call_forward_form'),
					phoneNumber = monster.util.unformatPhoneNumber(formData.number),
					isValidPhoneNumber = !_.isUndefined(phoneNumber);

				if (monster.ui.valid(featureForm) && isValidPhoneNumber) {
					formData.require_keypress = !formData.require_keypress;
					formData.number = phoneNumber;

					var selectedType = featureTemplate.find('.feature-select-mode button.selected').data('value');
					if (selectedType === 'off') {
						formData.enabled = false;
					}

					var payload = { call_forward: _.merge({}, formData), call_failover: _.merge({}, formData) };
					if (selectedType === 'failover') {
						payload.call_failover.enabled = true;
						payload.call_forward.enabled = false;
					} else if (selectedType === 'on') {
						payload.call_failover.enabled = false;
						payload.call_forward.enabled = true;
					}

					var userToSave = $.extend(true, {}, currentUser, payload);

					if (timeoutWarningBox.is(':visible')) {
						args.openedTab = 'name';
					}

					self.usersUpdateUser(userToSave, function(data) {
						args.userId = data.data.id;

						self.usersRender(args);
					});
				}
			});

			var popup = monster.ui.dialog(featureTemplate, {
				title: currentUser.extra.mapFeatures.call_forward.title,
				position: ['center', 20]
			});

			popup.find('.monster-button').blur();
		},

		usersRenderDoNotDisturb: function(featureUser) {
			var self = this,
				featureTemplate = $(self.getTemplate({
					name: 'feature-do_not_disturb',
					data: featureUser,
					submodule: 'users'
				})),
				switchFeature = featureTemplate.find('#checkbox_do_not_disturb');

			featureTemplate.find('.cancel-link').on('click', function() {
				popup.dialog('close').remove();
			});
			featureTemplate.find('.save').on('click', function() {
				var userToSave = featureUser;
				//update data.data.do_not_disturb depending on the switch status
				if (typeof userToSave.do_not_disturb === 'undefined') {
					userToSave.do_not_disturb = {};
				}
				if (typeof userToSave.do_not_disturb.enabled === 'undefined') {
					userToSave.do_not_disturb.enabled = false;
				}
				userToSave.do_not_disturb.enabled = switchFeature.prop('checked');

				self.usersUpdateUser(userToSave, function(data) {
					self.callApi({
						resource: 'user.updatePresence',
						data: {
							accountId: self.accountId,
							userId: userToSave.id,
							data: {
								action: 'set',
								state: userToSave.do_not_disturb.enabled ? 'confirmed' : 'terminated'
							}
						},
						error: function() {
							console.log('Failed to update presence state');
						}
					});
					popup.dialog('close').remove();
					self.usersRender({
						userId: userToSave.id,
						openedTab: 'features'
					});
				});
			});
			var popup = monster.ui.dialog(featureTemplate, {
				title: featureUser && featureUser.extra && featureUser.extra.mapFeatures.do_not_disturb.title,
				position: ['center', 20]
			});
		},

		usersRenderFindMeFollowMe: function(params) {
			var self = this;

			if (!params.userCallflow) {
				monster.ui.alert('error', self.i18n.active().users.find_me_follow_me.noNumber);
			} else if (!params.userDevices || params.userDevices.length === 0) {
				monster.ui.alert('error', self.i18n.active().users.find_me_follow_me.noDevice);
			} else {
				var currentUser = params.currentUser,
					userCallflow = params.userCallflow,
					featureTemplate = $(self.getTemplate({
						name: 'feature-find_me_follow_me',
						data: {
							currentUser: currentUser
						},
						submodule: 'users'
					})),
					switchFeature = featureTemplate.find('.switch-state'),
					featureForm = featureTemplate.find('#find_me_follow_me_form'),
					args = {
						callback: function() {
							popup.dialog('close').remove();
						},
						openedTab: 'features'
					},
					userDevices = {};

				var nodeSearch = userCallflow.flow,
					endpoints;

				while (nodeSearch.hasOwnProperty('module') && ['ring_group', 'user'].indexOf(nodeSearch.module) < 0) {
					nodeSearch = nodeSearch.children._;
				}
				endpoints = nodeSearch.module === 'ring_group' ? nodeSearch.data.endpoints : [];

				_.each(params.userDevices, function(val) {
					userDevices[val.id] = val;
				});

				endpoints = $.map(endpoints, function(endpoint) {
					if (userDevices[endpoint.id]) {
						var device = userDevices[endpoint.id];
						delete userDevices[endpoint.id];
						return {
							id: endpoint.id,
							delay: endpoint.delay,
							timeout: endpoint.timeout,
							name: device.name,
							icon: self.deviceIcons[device.device_type],
							disabled: false
						};
					}
				});

				_.each(userDevices, function(device) {
					endpoints.push({
						id: device.id,
						delay: 0,
						timeout: 0,
						name: device.name,
						icon: self.deviceIcons[device.device_type],
						disabled: true
					});
				});

				monster.pub('common.ringingDurationControl.render', {
					container: featureForm,
					endpoints: endpoints,
					hasDisableColumn: true
				});

				featureTemplate.find('.cancel-link').on('click', function() {
					popup.dialog('close').remove();
				});

				switchFeature.on('change', function() {
					$(this).prop('checked') ? featureTemplate.find('.content').slideDown() : featureTemplate.find('.content').slideUp();
				});

				featureTemplate.find('.save').on('click', function() {
					var enabled = switchFeature.prop('checked');

					monster.pub('common.ringingDurationControl.getEndpoints', {
						container: featureForm,
						callback: function(endpoints) {
							currentUser.smartpbx = currentUser.smartpbx || {};
							currentUser.smartpbx.find_me_follow_me = currentUser.smartpbx.find_me_follow_me || {};
							currentUser.smartpbx.find_me_follow_me.enabled = (enabled && endpoints.length > 0);

							var callflowNode = {};

							if (enabled && endpoints.length > 0) {
								callflowNode.module = 'ring_group';
								callflowNode.data = {
									strategy: 'simultaneous',
									timeout: 20,
									endpoints: []
								};

								_.each(endpoints, function(endpoint) {
									callflowNode.data.endpoints.push({
										id: endpoint.id,
										endpoint_type: 'device',
										delay: endpoint.delay,
										timeout: endpoint.timeout
									});

									if ((endpoint.delay + endpoint.timeout) > callflowNode.data.timeout) {
										callflowNode.data.timeout = (endpoint.delay + endpoint.timeout);
									}
								});
							} else {
								callflowNode.module = 'user';
								callflowNode.data = {
									can_call_self: false,
									id: currentUser.id,
									timeout: 20
								};
							}

							// In next 5 lines, look for user/group node, and replace it with the new data;
							var flow = userCallflow.flow;
							while (flow.hasOwnProperty('module') && ['ring_group', 'user'].indexOf(flow.module) < 0) {
								flow = flow.children._;
							}
							flow.module = callflowNode.module;
							flow.data = callflowNode.data;

							monster.parallel({
								callflow: function(callbackParallel) {
									self.usersUpdateCallflow(userCallflow, function(data) {
										callbackParallel && callbackParallel(null, data.data);
									});
								},
								user: function(callbackParallel) {
									self.usersUpdateUser(currentUser, function(data) {
										callbackParallel && callbackParallel(null, data.data);
									});
								}
							}, function(err, results) {
								args.userId = results.user.id;
								if (typeof params.saveCallback === 'function') {
									params.saveCallback(args);
								} else {
									self.usersRender(args);
								}
							});
						}
					});
				});

				var popup = monster.ui.dialog(featureTemplate, {
					title: currentUser.extra.mapFeatures.find_me_follow_me.title,
					position: ['center', 20]
				});
			}
		},

		usersFormatCallRecording: function(params) {
			var self = this,
				getDefaultValue = function() {
					return {
						enabled: 'default',
						accountValue: self.i18n.active().users.callRecording.toggleValues.off
					};
				},
				getCallflowValue = function(direction) {
					var defaultValue = getDefaultValue();

					return _.merge({}, defaultValue, direction === 'inbound' && {
						enabled: true
					});
				},
				getHierarchicalValue = _.partial(function(entities, direction, network) {
					var isUserEnabled = _.get(entities.user, ['call_recording', direction, network, 'enabled']),
						isUserConfigured = _.isBoolean(isUserEnabled),
						isAccountEnabled = _.get(entities.account, ['call_recording', direction, network, 'enabled']),
						isAccountConfigured = _.every([
							_.isBoolean(isAccountEnabled),
							_.has(entities.account, 'call_recording.endpoint')
						]),
						accountValueProp = isAccountEnabled ? 'on' : 'off',
						defaultValue = getDefaultValue();

					return _.merge({}, defaultValue, isUserConfigured && {
						enabled: isUserEnabled
					}, isAccountConfigured && {
						accountValue: monster.util.tryI18n(self.i18n.active().users.callRecording.toggleValues, accountValueProp)
					});
				}, {
					account: monster.apps.auth.currentAccount,
					user: params.currentUser
				}),
				getCallRecordingStructure = function(valueGetter) {
					var callDirections = [
							'inbound',
							'outbound'
						],
						networkTypes = [
							'onnet',
							'offnet'
						];

					return _
						.chain(callDirections)
						.flatMap(function(direction) {
							return _.map(networkTypes, function(network) {
								return {
									direction: direction,
									network: network,
									config: valueGetter(direction, network)
								};
							});
						})
						.groupBy('direction')
						.mapValues(_.flow(
							_.partial(_.keyBy, _, 'network'),
							_.partial(_.mapValues, _, 'config')
						))
						.value();
				},
				getConfigForSettings = function(settings, valueGetter) {
					return _.merge({
						timeLimit: _.get(settings, 'time_limit'),
						extra: getCallRecordingStructure(valueGetter)
					}, _.pick(settings, [
						'url',
						'format'
					]));
				},
				defaultSettings = {
					time_limit: 3600
				},
				callflowSettings = _.get(params.userCallflow, 'flow.data', {}),
				userSettings = _
					.chain(params.currentUser)
					.get('call_recording', {})
					.flatMap(_.values)
					.find({ enabled: true })
					.value(),
				configGeneratorsPerType = {
					defaults: _.partial(getConfigForSettings, defaultSettings, getDefaultValue),
					callflow: _.partial(getConfigForSettings, callflowSettings, getCallflowValue),
					hierarchical: _.partial(getConfigForSettings, userSettings, getHierarchicalValue)
				},
				isFeatureEnabled = params.currentUser.extra.mapFeatures.call_recording.active,
				isUserConfigured = _.has(params.currentUser, 'call_recording'),
				isCallflowConfigured = _.get(params.userCallflow, 'flow.module') === 'record_call',
				configType = _
					.chain(isFeatureEnabled ? [
						isUserConfigured && 'hierarchical',
						isCallflowConfigured && 'callflow'
					] : [])
					.find(_.isString)
					.defaultTo('defaults')
					.value(),
				config = configGeneratorsPerType[configType]();

			return _.merge({
				user: params.currentUser,
				canShowFields: _
					.chain(config.extra)
					.flatMap(_.values)
					.find({ enabled: true })
					.thru(_.negate(_.isUndefined))
					.value()
			}, _.pick(params, [
				'hasStorageConfigured'
			]), _.pick(self.appFlags.common.callRecording, [
				'supportedAudioFormats'
			]), config);
		},

		usersAnalyzeCallRecordingCallflow: function(callflow) {
			var self = this,
				formattedCallflow = $.extend(true, {}, callflow),
				updated = false;

			if (formattedCallflow && formattedCallflow.hasOwnProperty('flow')) {
				// If first node is a record call, we re-initialize callflow with the children
				if (formattedCallflow.flow.hasOwnProperty('module') && formattedCallflow.flow.module === 'record_call') {
					formattedCallflow.flow = formattedCallflow.flow.children._;
					updated = true;
				}

				var newFlow = formattedCallflow.flow;

				while (newFlow.hasOwnProperty('children') && newFlow.children.hasOwnProperty('_')) {
					if (newFlow.children._.module === 'record_call') {
						newFlow.children = newFlow.children._.children;
						updated = true;
					} else {
						newFlow = newFlow.children._;
					}
				}
			}

			return {
				newFlow: formattedCallflow,
				hasUpdate: updated
			};
		},

		usersCallRecordingNormalizeUser: function(template, formData, user) {
			var self = this,
				isEnabled = template.find('.switch-state').prop('checked');

			user.smartpbx = user.smartpbx || {};
			user.smartpbx.call_recording = user.smartpbx.call_recording || {};
			user.smartpbx.call_recording.enabled = isEnabled;

			if (isEnabled) {
				user.call_recording = $.extend(true, {}, user.call_recording, {
					inbound: {
						onnet: {},
						offnet: {}
					},
					outbound: {
						onnet: {},
						offnet: {}
					}
				});

				// First we made the decision that SmartPBX would set these 3 fields globally, so we remove individual settings first
				_.each(user.call_recording, function(category) {
					_.each(category, function(direction) {
						delete direction.time_limit;
						delete direction.url;
						delete direction.format;
					});
				});

				template.find('.call-recording-type').each(function() {
					var $this = $(this),
						type = $this.data('type'),
						category = type.substring(0, type.indexOf('-')),
						direction = type.substring(type.indexOf('-') + 1, type.length),
						hasValue = $this.find('button.selected').length,
						value = hasValue ? $this.find('button.selected').data('value') : 'default';

					// If value is set to something else than account default then we set the enabled boolean
					if (value && value !== 'default') {
						user.call_recording[category][direction].enabled = value === 'on' ? true : false;
					} else {
						delete user.call_recording[category][direction].enabled;

						if (_.isEmpty(user.call_recording[category][direction])) {
							delete user.call_recording[category][direction];
						}

						if (_.isEmpty(user.call_recording[category])) {
							delete user.call_recording[category];
						}
					}
				});

				if (formData.hasOwnProperty('url')) {
					_.each(user.call_recording, function(category, categoryName) {
						_.each(category, function(direction, directionName) {
							if (direction.enabled === true) {
								$.extend(true, direction, {
									time_limit: formData.time_limit,
									url: formData.url,
									format: formData.format
								});
							}
						});
					});
				}
			} else {
				user.call_recording = {};
			}

			if (_.isEmpty(user.call_recording)) {
				delete user.call_recording;
			}

			return user;
		},

		usersRenderCallRecording: function(params) {
			var self = this,
				templateData = self.usersFormatCallRecording(params),
				featureTemplate = $(self.getTemplate({
					name: 'feature-call_recording',
					data: templateData,
					submodule: 'users'
				})),
				switchFeature = featureTemplate.find('.switch-state'),
				featureForm = featureTemplate.find('#call_recording_form'),
				popup;

			monster.ui.validate(featureForm, self.appFlags.common.callRecording.validationConfig);

			switchFeature.on('change', function() {
				$(this).prop('checked') ? featureTemplate.find('.content').slideDown() : featureTemplate.find('.content').slideUp();
			});

			featureTemplate.find('.cancel-link').on('click', function() {
				popup.dialog('close').remove();
			});

			featureTemplate.find('.btn-group-wrapper button').on('click', function(e) {
				e.preventDefault();
				var $this = $(this);
				$this.siblings().removeClass('selected monster-button-primary');
				$this.addClass('selected monster-button-primary');

				// If there's 1 button "on" we display the settings, if not we hide them.
				featureTemplate.find('.call-recording-type button[data-value="on"].selected').length > 0 ? featureTemplate.find('.fields-settings').slideDown() : featureTemplate.find('.fields-settings').slideUp();
			});

			featureTemplate.find('.save').on('click', function() {
				var formatUserData,
					updateDB = function() {
						// Check if it's an old callflow , ie if it has call record action in callflow
						// If it does we remove them.
						var resultAnalyze = self.usersAnalyzeCallRecordingCallflow(params.userCallflow),
							afterCheck = function() {
								self.usersUpdateUser(formatUserData, function(updatedUser) {
									popup.dialog('close').remove();

									self.usersRender({
										userId: params.currentUser.id,
										openedTab: 'features'
									});
								});
							};

						if (resultAnalyze.hasUpdate) {
							self.usersUpdateCallflow(resultAnalyze.newFlow, function() {
								afterCheck();
							});
						} else {
							afterCheck();
						}
					};

				if (!featureTemplate.find('.switch-state').prop('checked')) {
					formatUserData = self.usersCallRecordingNormalizeUser(featureTemplate, undefined, params.currentUser);

					updateDB();
				} else if (monster.ui.valid(featureForm)) {
					var formData = monster.ui.getFormData('call_recording_form');
					formatUserData = self.usersCallRecordingNormalizeUser(featureTemplate, formData, params.currentUser);

					updateDB();
				}
			});

			popup = monster.ui.dialog(featureTemplate, {
				title: params.currentUser.extra.mapFeatures.call_recording.title,
				position: ['center', 20]
			});
		},

		usersRenderMusicOnHold: function(currentUser) {
			var self = this,
				silenceMediaId = 'silence_stream://300000',
				mediaToUpload;

			self.usersListMedias(function(medias) {
				var templateData = {
						showMediaUploadDisclosure: monster.config.whitelabel.showMediaUploadDisclosure,
						user: currentUser,
						silenceMedia: silenceMediaId,
						mediaList: medias,
						media: 'music_on_hold' in currentUser && 'media_id' in currentUser.music_on_hold ? currentUser.music_on_hold.media_id : silenceMediaId
					},
					featureTemplate = $(self.getTemplate({
						name: 'feature-music_on_hold',
						data: templateData,
						submodule: 'users'
					})),
					switchFeature = featureTemplate.find('.switch-state'),
					popup,
					closeUploadDiv = function(newMedia) {
						mediaToUpload = undefined;
						featureTemplate.find('.upload-div input').val('');
						featureTemplate.find('.upload-div').slideUp(function() {
							featureTemplate.find('.upload-toggle').removeClass('active');
						});
						if (newMedia) {
							var mediaSelect = featureTemplate.find('.media-dropdown');
							mediaSelect.append('<option value="' + newMedia.id + '">' + newMedia.name + '</option>');
							mediaSelect.val(newMedia.id);
						}
					};

				featureTemplate.find('.upload-input').fileUpload({
					inputOnly: true,
					wrapperClass: 'file-upload input-append',
					btnText: self.i18n.active().users.music_on_hold.audioUploadButton,
					btnClass: 'monster-button',
					maxSize: 5,
					success: function(results) {
						mediaToUpload = results[0];
					},
					error: function(errors) {
						if (errors.hasOwnProperty('size') && errors.size.length > 0) {
							monster.ui.alert(self.i18n.active().users.music_on_hold.fileTooBigAlert);
						}
						featureTemplate.find('.upload-div input').val('');
						mediaToUpload = undefined;
					}
				});

				featureTemplate.find('.cancel-link').on('click', function() {
					popup.dialog('close').remove();
				});

				switchFeature.on('change', function() {
					$(this).prop('checked') ? featureTemplate.find('.content').slideDown() : featureTemplate.find('.content').slideUp();
				});

				featureTemplate.find('.upload-toggle').on('click', function() {
					if ($(this).hasClass('active')) {
						featureTemplate.find('.upload-div').stop(true, true).slideUp();
					} else {
						featureTemplate.find('.upload-div').stop(true, true).slideDown();
					}
				});

				featureTemplate.find('.upload-cancel').on('click', function() {
					closeUploadDiv();
				});

				featureTemplate.find('.upload-submit').on('click', function() {
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
						monster.ui.alert(self.i18n.active().users.music_on_hold.emptyUploadAlert);
					}
				});

				featureTemplate.find('.save').on('click', function() {
					var selectedMedia = featureTemplate.find('.media-dropdown option:selected').val(),
						enabled = switchFeature.prop('checked');

					if (!('music_on_hold' in currentUser)) {
						currentUser.music_on_hold = {};
					}

					if ('media_id' in currentUser.music_on_hold || enabled) {
						if (enabled) {
							currentUser.music_on_hold = {
								media_id: selectedMedia
							};
						} else {
							currentUser.music_on_hold = {};
						}
						self.usersUpdateUser(currentUser, function(updatedUser) {
							popup.dialog('close').remove();
							self.usersRender({
								userId: currentUser.id,
								openedTab: 'features'
							});
						});
					} else {
						popup.dialog('close').remove();
						self.usersRender({
							userId: currentUser.id,
							openedTab: 'features'
						});
					}
				});

				popup = monster.ui.dialog(featureTemplate, {
					title: currentUser.extra.mapFeatures.music_on_hold.title,
					position: ['center', 20]
				});
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

			if (userData.hasOwnProperty('call_forward')) {
				if (userData.call_forward.number === '') {
					delete userData.call_forward.number;
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

			delete userData.include_directory;
			delete userData.features;
			delete userData.extra;
			delete userData[''];
			delete userData.confirm_password;

			return userData;
		},

		usersGetTemplate: function(type, userId, listUsers, callbackAfterData) {
			var self = this;

			if (type === 'name') {
				self.usersGetNameTemplate(userId, listUsers, callbackAfterData);
			} else if (type === 'numbers') {
				self.usersGetNumbersTemplate(userId, callbackAfterData);
			} else if (type === 'extensions') {
				self.usersGetExtensionsTemplate(userId, callbackAfterData);
			} else if (type === 'features') {
				self.usersGetFeaturesTemplate(userId, listUsers, callbackAfterData);
			} else if (type === 'devices') {
				self.usersGetDevicesTemplate(userId, callbackAfterData);
			} else if (type === 'licensed-user-role') {
				self.usersGetLicensedRoleTemplate(userId, callbackAfterData);
			}
		},

		usersGetFeaturesTemplate: function(userId, listUsers, callback) {
			var self = this;

			self.usersGetUser(userId, function(userData) {
				_.each(listUsers.users, function(user) {
					if (user.id === userData.id) {
						userData = $.extend(true, userData, user);
					}
				});

				var dataTemplate = self.usersFormatUserData({
						user: userData
					}),
					template = $(self.getTemplate({
						name: 'features',
						data: dataTemplate,
						submodule: 'users'
					}));

				callback && callback(template, dataTemplate);
			});
		},
		usersGetNameTemplate: function(userId, listUsers, callbackAfterFormat) {
			var self = this;

			monster.parallel({
				mainCallflowVMBox: function(callback) {
					self.usersGetMainCallflowAndVMBox({
						userId: userId,
						success: function(data) {
							callback(null, data);
						},
						error: function(err) {
							callback(err);
						}
					});
				},
				mainDirectory: function(callback) {
					self.usersGetMainDirectory(function(mainDirectory) {
						callback(null, mainDirectory);
					});
				},
				user: function(callback) {
					self.usersGetUser(userId, function(userData) {
						callback(null, userData);
					});
				}
			}, function(error, results) {
				var userData = results.user;

				_.each(listUsers.users, function(user) {
					if (user.id === results.user.id) {
						userData = $.extend(true, user, userData);

						return false;
					}
				});

				var dataTemplate = self.usersFormatUserData({
						user: userData,
						userMainCallflow: results.mainCallflowVMBox.callflow,
						userVMBox: results.mainCallflowVMBox.vmbox,
						mainDirectory: results.mainDirectory
					}),
					template = $(self.getTemplate({
						name: 'name',
						data: dataTemplate,
						submodule: 'users'
					}));

				monster.ui.validate(template.find('form.user-fields'), {
					rules: {
						'extra.ringingTimeout': {
							digits: true
						}
					},
					messages: {
						'first_name': {
							required: self.i18n.active().validation.required
						},
						'last_name': {
							required: self.i18n.active().validation.required
						}
					}
				});

				timezone.populateDropdown(template.find('#user_timezone'), dataTemplate.timezone || 'inherit', { inherit: self.i18n.active().defaultTimezone });

				monster.ui.tooltips(template, {
					options: {
						container: 'body'
					}
				});

				callbackAfterFormat && callbackAfterFormat(template, dataTemplate);
			});
		},

		usersGetDevicesData: function(data, pCallback) {
			var self = this,
				callback = _.isFunction(data) ? data : pCallback,
				data = _.isFunction(data) ? {} : data;

			self.callApi({
				resource: 'device.list',
				data: _.merge({
					accountId: self.accountId,
					filters: {
						paginate: 'false'
					}
				}, data.data),
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		/**
		 * Get user numbers data from API
		 * @param  {Object}   args
		 * @param  {String}   args.userId            User ID
		 * @param  {Boolean}  args.loadAllCallflows  Indicates if all callflows should be loaded from API
		 * @param  {Boolean}  args.loadUserDevices   Indicates if user devices should be loaded from API
		 * @param  {Function} args.callback          Function to be called when data has been obtained
		 */
		usersGetNumbersData: function(args) {
			var self = this,
				userId = args.userId,
				parallelRequests = {
					user: function(callbackParallel) {
						self.usersGetUser(userId, function(user) {
							callbackParallel(null, user);
						});
					},
					callflow: function(callbackParallel) {
						var response = {};

						// If all callflows are not required, only get user main callflow
						if (!args.loadAllCallflows) {
							self.usersGetMainCallflow(userId, function(callflow) {
								response.userCallflow = callflow;

								callbackParallel(null, response);
							});
							return;
						}

						// Else, get all callflows along with the main user callflow
						self.usersListCallflows(function(callflows) {
							response.list = callflows;

							var callflowId;

							$.each(callflows, function(k, callflowLoop) {
								/* Find Smart PBX Callflow of this user */
								if (callflowLoop.owner_id === userId && callflowLoop.type === 'mainUserCallflow') {
									callflowId = callflowLoop.id;

									return false;
								}
							});

							if (callflowId) {
								self.callApi({
									resource: 'callflow.get',
									data: {
										accountId: self.accountId,
										callflowId: callflowId
									},
									success: function(callflow) {
										response.userCallflow = callflow.data;

										callbackParallel(null, response);
									}
								});
							} else {
								callbackParallel(null, response);
							}
						});
					},
					numbers: function(callbackParallel) {
						self.usersListNumbers(function(listNumbers) {
							callbackParallel(null, listNumbers);
						});
					}
				};

			if (args.loadUserDevices) {
				parallelRequests.devices = function(callbackParallel) {
					self.usersListDeviceUser(userId, function(listDevices) {
						callbackParallel(null, listDevices);
					});
				};
			}

			monster.parallel(parallelRequests, function(err, results) {
				args.hasOwnProperty('callback') && args.callback(results);
			});
		},

		usersGetNumbersTemplate: function(userId, callback) {
			var self = this,
				template;

			self.usersGetFormattedNumbersData({
				userId: userId,
				loadNumbersView: true,
				callback: function(results) {
					template = $(self.getTemplate({
						name: 'numbers',
						data: _.merge({
							hideBuyNumbers: monster.config.whitelabel.hasOwnProperty('hideBuyNumbers')
								? monster.config.whitelabel.hideBuyNumbers
								: false
						}, results),
						submodule: 'users'
					}));

					_.each(results.assignedNumbers, function(number) {
						var numberDiv = template.find('[data-id="' + number.phoneNumber + '"]'),
							argsFeatures = {
								target: numberDiv.find('.edit-features'),
								numberData: number,
								afterUpdate: function(features) {
									monster.ui.paintNumberFeaturesIcon(features, numberDiv.find('.features'));
								}
							};

						monster.pub('common.numberFeaturesMenu.render', argsFeatures);
					});

					callback && callback(template, results);
				}
			});
		},
		usersGetDevicesTemplate: function(userId, callback) {
			var self = this,
				template;

			self.usersGetDevicesData(function(results) {
				var formattedResults = self.usersFormatDevicesData(userId, results);

				template = $(self.getTemplate({
					name: 'devices',
					data: _.merge({
						showTeammateDevice: showTeammateDevice
					}, formattedResults),
					submodule: 'users'
				}));

				callback && callback(template, results);
			});
		},
		usersGetExtensionsTemplate: function(userId, callback) {
			var self = this,
				template;

			self.usersGetFormattedNumbersData({
				userId: userId,
				loadAllExtensions: true,
				callback: function(results) {
					template = $(self.getTemplate({
						name: 'extensions',
						data: results,
						submodule: 'users'
					}));

					callback && callback(template, results);
				}
			});
		},
		usersGetLicensedRoleTemplate: function(userId, callback) {
			var self = this;

			self.usersGetUser(userId, function(user) {
				var formattedData = self.usersFormatLicensedRolesData(user),
					template = $(self.getTemplate({
						name: 'licensed-roles',
						data: formattedData,
						submodule: 'users'
					}));

				monster.ui.chosen(template.find('#licensed_role'));

				callback && callback(template, user);
			});
		},

		usersFormatLicensedRolesData: function(user) {
			var self = this,
				userPlanIds = _
					.chain(user)
					.get('service.plans', {})
					.keys()
					.value();

			return _.merge({
				availableRoles: self.appFlags.global.servicePlansRole
			}, !_.isEmpty(userPlanIds) && {
				selectedRole: _.head(userPlanIds)
			});
		},

		usersFormatDevicesData: function(userId, devices) {
			var self = this,
				assigned = _.filter(devices, { owner_id: userId }),
				unassigned = _.flatten([
					_.filter(devices, { owner_id: '' }),
					_.reject(devices, _.partial(_.has, _, 'owner_id'))
				]);

			return {
				countSpare: _.size(unassigned),
				emptyAssigned: _.isEmpty(assigned),
				emptySpare: _.isEmpty(unassigned),
				assignedDevices: _.keyBy(assigned, 'id'),
				unassignedDevices: _.keyBy(unassigned, 'id')
			};
		},

		/**
		 * Format user numbers data
		 * @param  {Object}   args
		 * @param  {Object}   args.data               User, callflows and numbers data
		 * @param  {Function} args.callback           Function to be called when the data has been formatted
		 * @param  {Boolean}  args.includeAllExtensions  Indicates if all extensions should be included in the formatted data
		 */
		usersFormatNumbersData: function(args) {
			var self = this,
				data = args.data,
				callback = args.callback,
				response = {
					countSpare: 0,
					assignedNumbers: [],
					unassignedNumbers: {},
					callflow: data.callflow.userCallflow,
					extensions: [],
					user: data.user || {}
				};

			if (data.hasOwnProperty('devices') && data.devices.length) {
				_.each(data.devices, function(device) {
					if (device.device_type === 'mobile') {
						data.numbers.numbers[device.mobile.mdn] = {
							assigned_to: response.user.id,
							features: [ 'mobile' ],
							isLocal: false,
							phoneNumber: device.mobile.mdn,
							state: 'in_service',
							used_by: 'mobile'
						};
					}
				});
			}

			if ('numbers' in data.numbers) {
				_.each(data.numbers.numbers, function(number, k) {
					/* TODO: Once locality is enabled, we need to remove it */
					number.localityEnabled = 'locality' in number ? true : false;

					/* Adding to spare numbers */
					if (!number.hasOwnProperty('used_by') || number.used_by === '') {
						response.countSpare++;
						response.unassignedNumbers[k] = number;
					} else if (number.used_by === 'mobile') {
						response.assignedNumbers.push(number);
					}
				});
			}

			if (response.callflow) {
				/* If a number is in a callflow and is returned by the phone_numbers, add it to the assigned numbers  */
				_.each(response.callflow.numbers, function(number) {
					if (number in data.numbers.numbers) {
						var numberElement = data.numbers.numbers[number];
						numberElement.phoneNumber = number;
						numberElement.isLocal = numberElement.features.indexOf('local') > -1;

						response.assignedNumbers.push(numberElement);
					} else if (self.isExtensionDisplayable(number)) {
						response.extensions.push(number);
					}
				});
			}

			response.assignedNumbers = _.sortBy(response.assignedNumbers, 'phoneNumber');

			response.emptyAssigned = _.isEmpty(response.assignedNumbers);
			response.emptySpare = _.isEmpty(response.unassignedNumbers);
			response.emptyExtensions = _.isEmpty(response.extensions);

			if (!args.includeAllExtensions) {
				callback && callback(response);
				return;
			}

			/* List of extensions */
			response.allExtensions = [];

			_.each(data.callflow.list, function(callflow) {
				_.each(callflow.numbers, function(number) {
					/* If it's a valid extension number (ie: a number that's not in the number database) */
					if (!(number in data.numbers.numbers) && !(_.isNaN(parseInt(number)))) {
						response.allExtensions.push(number);
					}
				});
			});

			/* Sort extensions so that we can recommend an available extension to a user whom would add a new one */
			response.allExtensions.sort(function(a, b) {
				var parsedA = parseInt(a),
					parsedB = parseInt(b),
					result = -1;

				if (parsedA > 0 && parsedB > 0) {
					result = parsedA > parsedB;
				}

				return result;
			});

			callback && callback(response);
		},

		usersFormatCreationData: function(data) {
			var self = this,
				fullName = monster.util.getUserFullName(data.user),
				callerIdName = fullName.substring(0, 15),
				provisionData = _
					.chain(data.user.device)
					.pick([
						'brand',
						'family',
						'model'
					])
					.mapValues(_.toLower)
					.value(),
				formattedData = {
					user: $.extend(true, {}, {
						service: {
							plans: {}
						},
						caller_id: {
							internal: {
								name: callerIdName,
								number: data.callflow.extension
							}
						},
						presence_id: data.callflow.extension,
						email: data.extra.differentEmail ? data.extra.email : data.user.username,
						priv_level: 'user',
						vm_to_email_enabled: true
					}, data.user),
					vmbox: self.usersNewMainVMBox(data.callflow.extension, fullName),
					callflow: {
						contact_list: {
							exclude: false
						},
						flow: {
							children: {
								_: {
									children: {},
									data: {},
									module: 'voicemail'
								}
							},
							data: {
								can_call_self: false,
								timeout: 20
							},
							module: 'user'
						},
						name: fullName + self.appFlags.users.smartPBXCallflowString,
						numbers: [ (data.callflow || {}).extension ]
					},
					extra: data.extra
				};

			/**
			 * Only set the `service` property if a user type (e.g. service plan)
			 * is selected
			 */
			if (formattedData.user.hasOwnProperty('extra')
				&& formattedData.user.extra.hasOwnProperty('licensedRole')
				&& formattedData.user.extra.licensedRole !== 'none') {
				formattedData.user.service.plans[formattedData.user.extra.licensedRole] = {
					accountId: monster.config.resellerId,
					overrides: {}
				};
			} else {
				delete formattedData.user.service;
			}

			if (!data.extra.createVmbox) {
				// Remove vmbox from formatted data and user callflow
				delete formattedData.vmbox;
				delete formattedData.callflow.flow.children._;
				formattedData.user.vm_to_email_enabled = false;
			}

			delete formattedData.user.extra;

			if (_.get(data, 'user.device.brand', 'none') === 'none') {
				delete formattedData.user.device;
				return formattedData;
			}

			formattedData.user.device = {
				device_type: 'sip_device',
				enabled: true,
				mac_address: data.user.device.mac_address,
				name: data.user.device.name,
				provision: {
					endpoint_brand: provisionData.brand,
					endpoint_family: provisionData.family,
					endpoint_model: provisionData.model
				},
				sip: {
					password: monster.util.randomString(12),
					realm: monster.apps.auth.currentAccount.realm,
					username: 'user_' + monster.util.randomString(10)
				},
				suppress_unregister_notifications: false,
				family: data.user.device.family
			};

			return formattedData;
		},

		/* Utils */

		usersDeleteCallflow: function(callflowId, callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.delete',
				data: {
					callflowId: callflowId,
					accountId: self.accountId,
					data: {}
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		/**
		 * Creates an user, with all its related components
		 * @param  {Object}   args
		 * @param  {Object}   args.data     User formatted data
		 * @param  {Function} args.success  Success callback
		 * @param  {Function} args.error    Error callback
		 */
		usersCreate: function(args) {
			var self = this,
				data = args.data,
				deviceData = _.get(data, 'user.device');

			delete data.user.device;

			monster.waterfall([
				function(callback) {
					self.usersCreateUser({
						data: {
							data: data.user
						},
						success: function(_dataUser) {
							data.user.id = _dataUser.id;
							callback(null, _dataUser);
						},
						error: function() {
							callback(true);
						},
						onChargesCancelled: function() {
							callback(true);
						}
					});
				},
				function(_dataUser, callback) {
					if (!data.extra.createVmbox) {
						callback(null, _dataUser);
						return;
					}

					data.vmbox.owner_id = _dataUser.id;
					self.usersCreateVMBox({
						data: {
							data: data.vmbox
						},
						success: function(_dataVM) {
							data.callflow.flow.children._.data.id = _dataVM.id;
							callback(null, _dataUser);
						},
						error: function() {
							callback(true);
						},
						onChargesCancelled: function() {
							// VMBox won't be created, so let's remove its data
							data.extra.createVmbox = false;
							delete data.vmbox;
							delete data.callflow.flow.children._;
							callback(null, _dataUser);
						}
					});
				},
				function(_dataUser, callback) {
					var userId = _dataUser.id;
					data.callflow.owner_id = userId;
					data.callflow.type = 'mainUserCallflow';
					data.callflow.flow.data.id = userId;

					self.usersCreateCallflow(data.callflow, function(_dataCF) {
						callback(null, _dataUser, _dataCF);
					});
				},
				function(_dataUser, _dataCF, callback) {
					if (!data.extra.includeInDirectory) {
						callback(null, _dataUser);
						return;
					}

					self.usersAddUserToMainDirectory(_dataUser, _dataCF.id, function(dataDirectory) {
						callback(null, _dataUser);
					});
				},
				function(_dataUser, callback) {
					if (!deviceData) {
						callback(null);
						return;
					}

					deviceData.owner_id = _dataUser.id;
					self.usersAddUserDevice({
						data: {
							data: deviceData
						},
						success: function(_device) {
							callback(null);
						},
						error: function() {
							callback(true);
						},
						onChargesCancelled: function() {
							// Allow to complete without errors, although the device won't be created
							callback(null);
						}
					});
				}
			],
			function(err) {
				if (err) {
					args.error();
					return;
				}

				args.success(data);
			});
		},

		/* Hack to support users from previous version */
		usersMigrateFromExtensions: function(userId, listExtensions, callback) {
			var self = this;

			self.usersGetUser(userId, function(user) {
				user.extra = {
					vmbox: {
						mailbox: listExtensions[0]
					}
				};

				var fullName = monster.util.getUserFullName(user),
					callflow = {
						contact_list: {
							exclude: false
						},
						flow: {
							children: {
								_: {
									children: {},
									data: {
									},
									module: 'voicemail'
								}
							},
							data: {
								id: user.id,
								can_call_self: false,
								timeout: 20
							},
							module: 'user'
						},
						name: fullName + self.appFlags.users.smartPBXCallflowString,
						numbers: listExtensions,
						owner_id: user.id,
						type: 'mainUserCallflow'
					};

				self.usersGetSuitableMainVMBoxSmartUser({
					user: user,
					success: function(_dataVM) {
						if (_.isEmpty(_dataVM)) {
							// Remove VMBox from callflow if there is none
							callflow.flow.children = {};
						} else {
							callflow.flow.children._.data.id = _dataVM.id;
						}

						self.usersCreateCallflow(callflow,
							function(_dataCF) {
								callback && callback(_dataCF);
							},
							function(errorPayload, globalHandler) {
								var errorCallback = function() {
									globalHandler && globalHandler(errorPayload, { generateError: true });
								};

								if (errorPayload.error === '400' && errorPayload.hasOwnProperty('data') && errorPayload.data.hasOwnProperty('numbers') && errorPayload.data.numbers.hasOwnProperty('unique')) {
									self.usersHasKazooUICallflow(callflow, function(existingCallflow) {
										self.usersMigrateKazooUIUser(callflow, existingCallflow, callback);
									}, errorCallback);
								} else {
									errorCallback();
								}
							},
							false
						);
					}
				});
			});
		},

		usersGetCallflowFromNumber: function(number, callback) {
			var self = this,
				found = false;

			self.callApi({
				resource: 'callflow.searchByNumber',
				data: {
					accountId: self.accountId,
					value: number
				},
				success: function(results) {
					if (results.data.length > 0) {
						_.each(results.data, function(callflow) {
							_.each(callflow.numbers, function(num) {
								if (num === number && found === false) {
									found = true;

									self.callApi({
										resource: 'callflow.get',
										data: {
											accountId: self.accountId,
											callflowId: callflow.id
										},
										success: function(callflow) {
											callback && callback(callflow.data);
										}
									});
								}
							});
						});

						if (found === false) {
							callback && callback({});
						}
					} else {
						callback && callback({});
					}
				}
			});
		},

		usersHasKazooUICallflow: function(callflow, success, error) {
			var self = this,
				parallelRequests = {},
				kazooUICallflowFound = 0,
				kazooUICallflow;

			// Check if we find a number that belong to a Kazoo-UI callflow
			_.each(callflow.numbers, function(number) {
				parallelRequests[number] = function(callback) {
					self.usersGetCallflowFromNumber(number, function(callflow) {
						if (!(callflow.hasOwnProperty('ui_metadata') && callflow.ui_metadata.hasOwnProperty('ui') && callflow.ui_metadata.ui === 'monster-ui')) {
							// If we already found a callflow
							if (typeof kazooUICallflow !== 'undefined') {
								// If it's not the same Callflow that we found before, we increment the # of callflows found, which will trigger an error later
								// If it's the same as before we do nothing
								if (callflow.id !== kazooUICallflow.id) {
									kazooUICallflowFound++;
								}
							} else {
								kazooUICallflowFound++;
								kazooUICallflow = callflow;
							}
						}

						callback && callback(null, {});
					});
				};
			});

			monster.parallel(parallelRequests, function(err, results) {
				// If we didn't find a single non-Monster-UI Callflow, then we trigger the error
				if (kazooUICallflowFound === 0) {
					error && error();
				// If we had more than 1 Kazoo UI callflow, show an error saying the migration is impossible
				} else if (kazooUICallflowFound > 1) {
					monster.ui.alert(self.i18n.active().users.migration.tooManyCallflows);
				// Else, we have found 1 callflow from Kazoo-UI, migration is possible, we continue with the success callback
				} else {
					success && success(kazooUICallflow);
				}
			});
		},

		usersMigrateKazooUIUser: function(callflowToCreate, existingCallflow, callback) {
			var self = this,
				newNumbers = [];

			// copy all the existing callflow numbers to the callflow we're about to create
			callflowToCreate.numbers = existingCallflow.numbers;

			// Update the numbers of the existing callflow so that we keep a trace of the migration
			_.each(existingCallflow.numbers, function(number) {
				newNumbers.push('old_' + number + '_r' + monster.util.randomString(6));
			});
			existingCallflow.numbers = newNumbers;

			// Make sure the User knows what's going to happen
			monster.ui.confirm(self.i18n.active().users.migration.confirmMigration, function() {
				// First update the existing callflow with its new fake numbers
				self.usersUpdateCallflow(existingCallflow, function() {
					// Now that the numbers have been changed, we can create the new Monster UI Callflow
					self.usersCreateCallflow(callflowToCreate, function(newCallflow) {
						// Once all this is done, continue normally to the SmartPBX normal update
						callback && callback(newCallflow);
					});
				});
			});
		},

		usersAddUserToMainDirectory: function(dataUser, callflowId, callback) {
			var self = this;

			self.usersGetMainDirectory(function(directory) {
				dataUser.directories = dataUser.directories || {};
				dataUser.directories[directory.id] = callflowId;

				self.usersUpdateUser(dataUser, function(data) {
					callback && callback(data);
				});
			});
		},

		/**
		 * Creates a device for a user
		 * @param  {Object}   args
		 * @param  {Object}   args.data                  Data to be sent by the SDK to the API
		 * @param  {Object}   args.data.data             Data provided for the device to be created
		 * @param  {Function} [args.success]             Success callback
		 * @param  {Function} [args.error]               Error callback
		 * @param  {Function} [args.onChargesCancelled]  Callback to be executed when charges are
		 *                                               not accepted
		 */
		usersAddUserDevice: function(args) {
			var self = this;
			self.callApi({
				resource: 'device.create',
				data: _.merge({
					accountId: self.accountId
				}, args.data),
				success: function(data) {
					args.hasOwnProperty('success') && args.success(data.data);
				},
				error: function(parsedError) {
					args.hasOwnProperty('error') && args.error(parsedError);
				},
				onChargesCancelled: function() {
					args.hasOwnProperty('onChargesCancelled') && args.onChargesCancelled();
				}
			});
		},

		usersGetMainCallflow: function(userId, callback) {
			var self = this;

			self.usersListCallflowsUser(userId, function(listCallflows) {
				var indexMain = -1;

				_.each(listCallflows, function(callflow, index) {
					if (callflow.type === 'mainUserCallflow' || !('type' in callflow)) {
						indexMain = index;
						return false;
					}
				});

				if (indexMain === -1) {
					// monster.ui.toast({
					// 	type: 'error',
					// 	message: self.i18n.active().users.noUserCallflow
					// });
					callback(null);
				} else {
					self.callApi({
						resource: 'callflow.get',
						data: {
							accountId: self.accountId,
							callflowId: listCallflows[indexMain].id
						},
						success: function(data) {
							callback(data.data);
						},
						error: function() {
							callback(listCallflows[indexMain]);
						}
					});
				}
			});
		},

		usersSearchMobileCallflowsByNumber: function(userId, phoneNumber, callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.searchByNumber',
				data: {
					accountId: self.accountId,
					value: phoneNumber,
					filter_owner_id: userId,
					filter_type: 'mobile'
				},
				success: function(data) {
					callback(data.data[0]);
				}
			});
		},

		usersGetMainDirectory: function(callback) {
			var self = this;

			self.usersListDirectories(function(listDirectories) {
				var indexMain = -1;

				_.each(listDirectories, function(directory, index) {
					if (directory.name === 'SmartPBX Directory') {
						indexMain = index;

						return false;
					}
				});

				if (indexMain === -1) {
					self.usersCreateMainDirectory(function(data) {
						callback(data);
					});
				} else {
					callback(listDirectories[indexMain]);
				}
			});
		},

		usersListDirectories: function(callback) {
			var self = this;

			self.callApi({
				resource: 'directory.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: 'false'
					}
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		usersCreateMainDirectory: function(callback) {
			var self = this,
				dataDirectory = {
					confirm_match: false,
					max_dtmf: 0,
					min_dtmf: 3,
					name: 'SmartPBX Directory',
					sort_by: 'last_name'
				};

			self.callApi({
				resource: 'directory.create',
				data: {
					accountId: self.accountId,
					data: dataDirectory
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		usersListCallflows: function(callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: 'false'
					}
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersListCallflowsUser: function(userId, callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.list',
				data: {
					accountId: self.accountId,
					filters: {
						filter_owner_id: userId,
						paginate: 'false'
					}
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		/**
		 * Gets the list of vmboxes
		 * @param  {Object}   args
		 * @param  {Object}   args.data     Data to be used by the SDK to query the API
		 * @param  {Function} args.success  Success callback
		 * @param  {Function} args.error    Error callback
		 */
		usersListVMBoxes: function(args) {
			var self = this;

			self.callApi({
				resource: 'voicemail.list',
				data: _.merge({
					accountId: self.accountId,
					filters: {
						paginate: 'false'
					}
				}, args.data),
				success: function(data) {
					args.hasOwnProperty('success') && args.success(data.data);
				},
				error: function(parsedError) {
					args.hasOwnProperty('error') && args.error(parsedError);
				}
			});
		},

		/**
		 * Creates a Voicemail Box
		 * @param  {Object}   args
		 * @param  {Object}   args.data                  Data to be sent by the SDK to the API
		 * @param  {Object}   args.data.voicemailId      Voicemail box ID
		 * @param  {Boolean}  [args.data.generateError]  Whether or not to display the generic
		 *                                               Monster UI error dialog when the request
		 *                                               fails.
		 * @param  {Function} [args.success]             Success callback
		 * @param  {Function} [args.error]               Error callback
		 */
		usersGetVMBox: function(args) {
			var self = this;

			self.callApi({
				resource: 'voicemail.get',
				data: _.merge({
					accountId: self.accountId
				}, args.data),
				success: function(data) {
					_.has(args, 'success') && args.success(data.data);
				},
				error: function(parsedError, error, globalHandler) {
					_.has(args, 'error') && args.error(parsedError, error, globalHandler);
				}
			});
		},

		/**
		 * Creates a Voicemail Box
		 * @param  {Object}   args
		 * @param  {Object}   args.data                  Data to be sent by the SDK to the API
		 * @param  {Object}   args.data.data             Data provided for the Voicemail Box to be
		 *                                               created
		 * @param  {Function} [args.success]             Success callback
		 * @param  {Function} [args.error]               Error callback
		 * @param  {Function} [args.onChargesCancelled]  Callback to be executed when charges are
		 *                                               not accepted
		 */
		usersCreateVMBox: function(args) {
			var self = this;

			self.callApi({
				resource: 'voicemail.create',
				data: _.merge({
					accountId: self.accountId
				}, args.data),
				success: function(data) {
					args.hasOwnProperty('success') && args.success(data.data);
				},
				error: function(parsedError) {
					args.hasOwnProperty('error') && args.error(parsedError);
				},
				onChargesCancelled: function() {
					args.hasOwnProperty('onChargesCancelled') && args.onChargesCancelled();
				}
			});
		},

		usersUpdateVMBox: function(vmData, callback) {
			var self = this;

			// VMboxes should not specify any timezone in order to use the user's default.
			delete vmData.timezone;

			self.callApi({
				resource: 'voicemail.update',
				data: {
					accountId: self.accountId,
					data: vmData,
					voicemailId: vmData.id
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersGetUser: function(userId, callback) {
			var self = this;

			self.callApi({
				resource: 'user.get',
				data: {
					accountId: self.accountId,
					userId: userId
				},
				success: function(user) {
					callback && callback(user.data);
				}
			});
		},

		usersUpdateOriginalUser: function(user, callback) {
			var self = this;

			self.usersUpdateUserAPI(user, callback, monster.apps.auth.originalAccount.id);
		},

		usersUpdateUser: function(userData, callback) {
			var self = this;

			userData = self.usersCleanUserData(userData);

			self.usersUpdateUserAPI(userData, callback, self.accountId);
		},

		usersUpdateUserAPI: function(userData, callback, accountId) {
			var self = this;

			self.callApi({
				resource: 'user.update',
				data: {
					accountId: accountId,
					userId: userData.id,
					data: userData
				},
				success: function(userData) {
					callback && callback(userData);
				}
			});
		},

		usersIsSmartConference: function(name) {
			var self = this;

			return _.includes(name, self.appFlags.users.smartPBXConferenceString);
		},

		usersGetConferenceFeature: function(userId, globalCallback) {
			var self = this;

			monster.parallel({
				listConfNumbers: function(callback) {
					self.usersListConfNumbers(function(numbers) {
						callback && callback(null, numbers);
					});
				},
				conference: function(callback) {
					monster.waterfall([
						function(next) {
							self.usersListConferences(userId, _.partial(next, null));
						},
						function(conferences, next) {
							var conferenceId = _
								.chain(conferences)
								.find(_.flow(
									_.partial(_.get, _, 'name'),
									_.bind(self.usersIsSmartConference, self)
								))
								.get('id')
								.value();

							if (!_.isString(conferenceId)) {
								return next(null, {});
							}
							self.usersGetConference(conferenceId, _.partial(next, null));
						}
					], callback);
				}
			}, function(err, results) {
				globalCallback && globalCallback(results);
			});
		},

		usersListConfNumbers: function(callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.list',
				data: {
					accountId: self.accountId,
					filters: {
						filter_type: 'conference',
						paginate: 'false'
					}
				},
				success: function(data) {
					var numbers = [];

					_.each(data.data, function(conf) {
						if (conf.name === 'MainConference') {
							if (conf.numbers.length > 0 && conf.numbers[0] !== 'undefinedconf') {
								numbers = numbers.concat(conf.numbers);
							}
						}
					});

					callback && callback(numbers);
				}
			});
		},

		usersListConferences: function(userId, callback) {
			var self = this;

			self.callApi({
				resource: 'conference.list',
				data: {
					accountId: self.accountId,
					filters: {
						filter_owner_id: userId,
						paginate: 'false'
					}
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersGetConference: function(conferenceId, callback) {
			var self = this;

			self.callApi({
				resource: 'conference.get',
				data: {
					accountId: self.accountId,
					conferenceId: conferenceId
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersUnassignConference: function(conferenceId, callback) {
			var self = this;

			self.usersGetConference(conferenceId, function(conference) {
				conference.name = 'Unassigned ' + conference.name;
				delete conference.owner_id;

				self.usersUpdateConference(conference, function(conference) {
					callback && callback(conference);
				});
			});
		},

		usersUpdateConference: function(conference, callback) {
			var self = this;

			self.callApi({
				resource: 'conference.update',
				data: {
					accountId: self.accountId,
					conferenceId: conference.id,
					data: conference
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersCreateConference: function(conference, callback) {
			var self = this;

			self.callApi({
				resource: 'conference.create',
				data: {
					accountId: self.accountId,
					data: conference
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersDeleteConference: function(conferenceId, callback) {
			var self = this;

			self.callApi({
				resource: 'conference.delete',
				data: {
					accountId: self.accountId,
					conferenceId: conferenceId,
					data: {}
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersListDeviceUser: function(userId, callback) {
			var self = this;

			self.callApi({
				resource: 'device.list',
				data: {
					accountId: self.accountId,
					filters: {
						filter_owner_id: userId,
						paginate: 'false'
					}
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersListMedias: function(callback) {
			var self = this;

			self.callApi({
				resource: 'media.list',
				data: {
					accountId: self.accountId
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersGetData: function(callback) {
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
							callback(null, dataUsers.data);
						}
					});
				},
				callflows: function(callback) {
					self.usersListCallflows(function(callflows) {
						callback(null, callflows);
					});
				},
				devices: function(callback) {
					self.usersGetDevicesData({
						data: {
							filters: {
								with_status: 'true'
							}
						}
					}, function(devices) {
						callback(null, devices);
					});
				}
			}, function(err, results) {
				callback && callback(results);
			});
		},

		/**
		 * @param  {Object} data
		 * @param  {String[]} data.newDevices List of device IDs to assign
		 * @param  {String[]} data.oldDevices List of device IDs to unassign
		 * @param  {String} userId
		 * @param  {Function} callback
		 */
		usersUpdateDevices: function(data, userId, callback) {
			var self = this,
				getUserMainCallflow = function getUserMainCallflow(userId, next) {
					self.usersGetMainCallflow(userId, _.partial(next, null));
				},
				assignDeviceFactory = function assignDeviceFactory(userId, userMainCallflowId, deviceId) {
					return _.bind(self.usersUpdateDeviceAssignmentFromUser, self, deviceId, userId, userMainCallflowId);
				},
				unassignDeviceFactory = function unassignDeviceFactory(deviceId) {
					return _.bind(self.usersUpdateDeviceAssignmentFromUser, self, deviceId, null, null);
				},
				updateCallflowEndpoints = function updateCallflowEndpoints(updatedEndpoints, callflowId, next) {
					self.patchCallflow({
						data: {
							callflowId: callflowId,
							data: {
								flow: _.isEmpty(updatedEndpoints) ? {
									module: 'user',
									data: {
										can_call_self: false,
										endpoints: null,
										id: userId,
										timeout: 20
									}
								} : {
									data: {
										endpoints: updatedEndpoints
									}
								}
							}
						},
						success: _.partial(next, null),
						error: _.partial(next, true)
					});
				},
				disableFindMeFollowMeForUserId = function disableFindMeFollowMeForUserId(userId, next) {
					self.usersPatchUser({
						data: {
							userId: userId,
							data: {
								smartpbx: {
									find_me_follow_me: false
								}
							}
						},
						success: _.partial(next, null),
						error: _.partial(next, true)
					});
				},
				maybeUpdateUserAndCallflow = function maybeUpdateUserAndCallflow(userId, userCallflow, deviceIdsRemoved, next) {
					var hasRingGroupModule = _.get(userCallflow, 'flow.module') === 'ring_group',
						currentEndpoints = _.get(userCallflow, 'flow.data.endpoints', []),
						updatedEndpoints = _.reject(currentEndpoints, _.flow(
							_.partial(_.get, _, 'id'),
							_.partial(_.includes, deviceIdsRemoved)
						)),
						whereEndpointsRemoved = _.size(updatedEndpoints) < _.size(currentEndpoints);

					monster.parallel(_.flatten([
						hasRingGroupModule && whereEndpointsRemoved ? [
							_.partial(updateCallflowEndpoints, updatedEndpoints, userCallflow.id)
						] : [],
						hasRingGroupModule && whereEndpointsRemoved && _.isEmpty(updatedEndpoints) ? [
							_.partial(disableFindMeFollowMeForUserId, userId)
						] : []
					]), next);
				},
				updateEntities = function updateEntities(userId, devices, userMainCallflow, next) {
					monster.parallel(_.flatten([
						_.map(data.newDevices, _.partial(assignDeviceFactory, userId, _.get(userMainCallflow, 'id'))),
						_.map(data.oldDevices, unassignDeviceFactory),
						_.partial(maybeUpdateUserAndCallflow, userId, userMainCallflow, data.oldDevices)
					]), next);
				};

			monster.waterfall([
				_.partial(getUserMainCallflow, userId),
				_.partial(updateEntities, userId, data)
			], callback);
		},

		usersUpdateDeviceAssignmentFromUser: function(deviceId, userId, userMainCallflowId, mainCallback) {
			var self = this,
				getDevice = function getDevice(deviceId, callback) {
					self.callApi({
						resource: 'device.get',
						data: {
							accountId: self.accountId,
							deviceId: deviceId
						},
						success: _.flow(
							_.partial(_.get, _, 'data'),
							_.partial(callback, null)
						),
						error: _.partial(callback, true)
					});
				},
				patchDevice = function patchDevice(data, deviceId, callback) {
					self.callApi({
						resource: 'device.patch',
						data: {
							accountId: self.accountId,
							deviceId: deviceId,
							data: data
						},
						success: _.flow(
							_.partial(_.get, _, 'data'),
							_.partial(callback, null)
						),
						error: _.partial(callback, true)
					});
				},
				maybeUpdateMobileCallflowAssignment = function maybeUpdateMobileCallflowAssignment(userId, userMainCallflowId, device, callback) {
					if (device.device_type !== 'mobile') {
						return callback(null);
					}
					self.updateMobileCallflowAssignment(userId, userMainCallflowId, device, callback);
				},
				updateDeviceAssignment = function updateDeviceAssignment(userId, userMainCallflowId, device, callback) {
					var updatedDevice = {
						owner_id: userId
					};

					monster.parallel([
						_.partial(maybeUpdateMobileCallflowAssignment, userId, userMainCallflowId, device),
						_.partial(patchDevice, updatedDevice, device.id)
					], callback);
				};

			monster.waterfall([
				_.partial(getDevice, deviceId),
				_.partial(updateDeviceAssignment, userId, userMainCallflowId)
			], mainCallback);
		},

		usersUpdateCallflowNumbers: function(userId, callflowId, numbers, callback) {
			var self = this;

			if (numbers.length > 0) {
				if (callflowId) {
					self.callApi({
						resource: 'callflow.get',
						data: {
							accountId: self.accountId,
							callflowId: callflowId
						},
						success: function(getCallflowData) {
							getCallflowData.data.numbers = numbers;

							self.usersUpdateCallflow(getCallflowData.data, function(callflowData) {
								callback && callback(callflowData);
							});
						}
					});
				} else {
					if (numbers[0].length < 7) {
						self.usersMigrateFromExtensions(userId, numbers, function(data) {
							callback && callback(data);
						});
					} else {
						monster.ui.toast({
							type: 'error',
							message: self.i18n.active().users.needExtensionFirst
						});
					}
				}
			} else {
				monster.ui.toast({
					type: 'error',
					message: self.i18n.active().users.noNumberCallflow
				});
			}
		},

		usersListNumbers: function(callback) {
			var self = this;

			self.callApi({
				resource: 'numbers.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: 'false'
					}
				},
				success: function(numbers) {
					callback && callback(numbers.data);
				}
			});
		},

		usersUpdateCallflow: function(callflow, callback) {
			var self = this;

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
		},

		usersCreateCallflow: function(callflow, success, error, generateError) {
			var self = this;

			self.callApi({
				resource: 'callflow.create',
				data: {
					accountId: self.accountId,
					data: callflow,
					generateError: generateError === false ? false : true
				},
				success: function(callflowData) {
					success && success(callflowData.data);
				},
				error: function(callflowData, junk, globalHandler) {
					error && error(callflowData, globalHandler);
				}
			});
		},

		/**
		 * Update voicemail box, if needed
		 * @param  {Object}   args
		 * @param  {Object}   args.user           Kazoo user
		 * @param  {String}   args.oldPresenceId  Previous user presence ID
		 * @param  {Function} [args.callback]     Optional callback
		 */
		usersSmartUpdateVMBox: function(args) {
			var self = this,
				user = args.user,
				callback = args.callback,
				oldPresenceId = args.oldPresenceId || undefined;

			monster.waterfall([
				function(wfCallback) {
					self.usersGetMainCallflowAndVMBox({
						userId: user.id,
						success: function(data) {
							wfCallback(null, data.vmbox);
						}
					});
				},
				function(vmbox, wfCallback) {
					if (!vmbox) {
						wfCallback(null, {});
						return;
					}

					vmbox.name = self.usersGetMainVMBoxName(monster.util.getUserFullName(user));
					// We only want to update the vmbox number if it was already synced with the presenceId (and if the presenceId was not already set)
					// This allows us to support old clients who have mailbox number != than their extension number
					if (oldPresenceId === vmbox.mailbox) {
						// If it's synced, then we update the vmbox number as long as the main extension is set to something different than 'unset' in which case we don't update the vmbox number value
						vmbox.mailbox = (user.presence_id && user.presence_id !== 'unset') ? user.presence_id + '' : vmbox.mailbox;
					}

					self.usersUpdateVMBox(vmbox, function(vmboxSaved) {
						wfCallback(null, vmboxSaved);
					});
				}
			], function(err, vmboxSaved) {
				callback && callback(vmboxSaved);
			});
		},

		usersUpdateConferencing: function(data, globalCallback) {
			var self = this;

			monster.parallel({
				conference: function(callback) {
					var baseConference = {
							name: monster.util.getUserFullName(data.user) + self.appFlags.users.smartPBXConferenceString,
							owner_id: data.user.id,
							play_name_on_join: true,
							member: {
								join_muted: false
							},
							conference_numbers: []
						},
						formData = monster.ui.getFormData('conferencing_form');

					monster.util.dataFlags.add({ source: 'smartpbx' }, baseConference);

					if (formData.video) {
						formData = _.merge(formData, {
							video: true,
							profile_name: 'video',
							caller_controls: 'video-participant',
							moderator_controls: 'video-moderator'
						});
					}

					baseConference = $.extend(true, {}, baseConference, formData);

					if (_.isEmpty(data.conference)) {
						self.usersCreateConference(baseConference, function(conference) {
							callback && callback(null, conference);
						});
					} else {
						baseConference = $.extend(true, {}, data.conference, baseConference);

						if (!formData.video) {
							delete baseConference.video;
							delete baseConference.profile_name;
							delete baseConference.caller_controls;
							delete baseConference.moderator_controls;
						}

						self.usersUpdateConference(baseConference, function(conference) {
							callback && callback(null, conference);
						});
					}
				},
				user: function(callback) {
					if (data.user.smartpbx && data.user.smartpbx.conferencing && data.user.smartpbx.conferencing.enabled === true) {
						callback && callback(null, data.user);
					} else {
						data.user.smartpbx = data.user.smartpbx || {};
						data.user.smartpbx.conferencing = data.user.smartpbx.conferencing || {};

						data.user.smartpbx.conferencing.enabled = true;

						self.usersUpdateUser(data.user, function(user) {
							callback && callback(null, user.data);
						});
					}
				}
			}, function(err, results) {
				globalCallback && globalCallback(results);
			});
		},

		usersUpdateFaxing: function(data, newNumber, globalCallback) {
			var self = this;

			monster.parallel({
				callflow: function(callback) {
					var baseCallflow = {};

					self.usersListCallflowsUser(data.user.id, function(callflows) {
						_.each(callflows, function(callflow) {
							if (callflow.type === 'faxing') {
								baseCallflow.id = callflow.id;

								return false;
							}
						});

						self.usersUpdateCallflowFaxing(data, newNumber, baseCallflow, function(callflow) {
							callback && callback(null, callflow);
						});
					});
				},
				user: function(callback) {
					if (data.user.smartpbx && data.user.smartpbx.faxing && data.user.smartpbx.faxing.enabled === true) {
						callback && callback(null, data.user);
					} else {
						data.user.smartpbx = data.user.smartpbx || {};
						data.user.smartpbx.faxing = data.user.smartpbx.faxing || {};

						data.user.smartpbx.faxing.enabled = true;

						self.usersUpdateUser(data.user, function(user) {
							callback && callback(null, user.data);
						});
					}
				}
			}, function(err, results) {
				globalCallback && globalCallback(results);
			});
		},

		usersUpdateCallflowFaxing: function(data, newNumber, callflow, callback) {
			var self = this,
				user = data.user,
				faxbox = data.faxbox,
				baseCallflow = {
					type: 'faxing',
					owner_id: user.id,
					numbers: [ newNumber ],
					flow: {
						module: 'faxbox',
						children: {},
						data: {
							id: data.hasOwnProperty('faxbox') ? faxbox.id : ''
						}
					}
				},
				number = {
					caller_id: newNumber,
					fax_identity: monster.util.formatPhoneNumber(newNumber)
				};

			callflow = $.extend(true, {}, baseCallflow, callflow);

			if (callflow.hasOwnProperty('id')) {
				faxbox = $.extend(true, {}, faxbox, number);

				self.callApi({
					resource: 'faxbox.update',
					data: {
						accountId: self.accountId,
						faxboxId: faxbox.id,
						data: faxbox
					},
					success: function(_data, status) {
						self.usersUpdateCallflow(callflow, function(callflow) {
							callback && callback(callflow);
						});
					}
				});
			} else {
				var defaultFaxbox = {
					retries: 3,
					name: user.first_name.concat(' ', user.last_name, self.i18n.active().users.faxing.defaultSettings.nameExtension),
					caller_name: user.first_name.concat(' ', user.last_name),
					fax_header: monster.config.whitelabel.companyName.concat(self.i18n.active().users.faxing.defaultSettings.headerExtension),
					fax_timezone: user.timezone,
					owner_id: user.id
				};

				faxbox = $.extend(true, {}, defaultFaxbox, number);

				self.callApi({
					resource: 'faxbox.create',
					data: {
						accountId: self.accountId,
						userId: user.id,
						data: faxbox
					},
					success: function(_data, status) {
						callflow.flow.data.id = _data.data.id;

						self.usersCreateCallflow(callflow, function(callflow) {
							callback && callback(callflow);
						});
					}
				});
			}
		},

		usersRemoveBulkConferences: function(conferences, forceDelete, callback) {
			var self = this,
				listRequests = [];

			_.each(conferences, function(conference) {
				listRequests.push(function(subCallback) {
					if (forceDelete) {
						self.usersDeleteConference(conference.id, function(data) {
							subCallback(null, data);
						});
					} else {
						self.usersUnassignConference(conference.id, function(data) {
							subCallback(null, data);
						});
					}
				});
			});

			monster.parallel(listRequests, function(err, results) {
				callback && callback(results);
			});
		},

		usersDeleteConferencing: function(userId, globalCallback) {
			var self = this;

			monster.parallel({
				conferences: function(callback) {
					monster.waterfall([
						function(next) {
							self.usersListConferences(userId, _.partial(next, null));
						},
						function(conferences, next) {
							self.usersRemoveBulkConferences(_.filter(conferences, _.flow(
								_.partial(_.get, _, 'name'),
								_.bind(self.usersIsSmartConference, self)
							)), true, _.partial(next, null));
						}
					], callback);
				},
				user: function(callback) {
					self.usersGetUser(userId, function(user) {
						//user.conferencing_enabled = false;
						user.smartpbx = user.smartpbx || {};
						user.smartpbx.conferencing = user.smartpbx.conferencing || {};

						user.smartpbx.conferencing.enabled = false;

						self.usersUpdateUser(user, function(user) {
							callback(null, user);
						});
					});
				}
			}, function(err, results) {
				globalCallback && globalCallback(results);
			});
		},

		usersDeleteFaxing: function(userId, globalCallback) {
			var self = this;

			monster.parallel({
				callflows: function(callback) {
					self.usersListCallflowsUser(userId, function(callflows) {
						var listRequests = [];

						_.each(callflows, function(callflow) {
							if (callflow.type === 'faxing') {
								listRequests.push(function(subCallback) {
									self.callApi({
										resource: 'callflow.get',
										data: {
											accountId: self.accountId,
											callflowId: callflow.id
										},
										success: function(data, status) {
											self.callApi({
												resource: 'faxbox.delete',
												data: {
													accountId: self.accountId,
													faxboxId: data.data.flow.data.faxbox_id || data.data.flow.data.id,
													generateError: false
												},
												success: function(_data, status) {
													self.usersDeleteCallflow(callflow.id, function(results) {
														subCallback(null, results);
													});
												},
												error: function(_data, error) {
													self.usersDeleteCallflow(callflow.id, function(results) {
														subCallback(null, results);
													});
												}
											});
										}
									});
								});
							}
						});

						monster.parallel(listRequests, function(err, results) {
							callback && callback(results);
						});
					});
				},
				user: function(callback) {
					self.usersGetUser(userId, function(user) {
						//user.faxing_enabled = false;
						user.smartpbx = user.smartpbx || {};
						user.smartpbx.faxing = user.smartpbx.faxing || {};

						user.smartpbx.faxing.enabled = false;

						self.usersUpdateUser(user, function(user) {
							callback(null, user);
						});
					});
				}
			}, function(err, results) {
				globalCallback && globalCallback(results);
			});
		},

		usersSortExtensions: function(a, b) {
			var parsedA = parseInt(a),
				parsedB = parseInt(b),
				result = -1;

			if (parsedA > 0 && parsedB > 0) {
				result = parsedA > parsedB;
			}

			return result;
		},

		usersResetPassword: function(data, callback) {
			var self = this,
				dataPassword = {
					username: data.username,
					account_name: data.account_name,
					ui_url: window.location.href.split('#')[0]
				};

			self.callApi({
				resource: 'auth.recovery',
				data: {
					data: dataPassword
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		usersCreateUser: function(args) {
			var self = this;

			self.callApi({
				resource: 'user.create',
				data: _.merge({
					accountId: self.accountId
				}, args.data),
				success: function(data, status) {
					args.hasOwnProperty('success') && args.success(data.data);
				},
				error: function(parsedError) {
					args.hasOwnProperty('error') && args.error(parsedError);
				},
				onChargesCancelled: function() {
					args.hasOwnProperty('onChargesCancelled') && args.onChargesCancelled();
				}
			});
		},

		/**
		 * Adds a main VMBox to an existing user
		 * @param  {Object}   args
		 * @param  {String}   args.user               User
		 * @param  {Boolean}  args.deleteAfterNotify  Delete after notify voicemail box flag
		 * @param  {Function} args.callback           Callback for monster.waterfall
		 */
		usersAddMainVMBoxToUser: function(args) {
			var self = this,
				user = args.user,
				userId = user.id;

			monster.waterfall([
				function(waterfallCallback) {
					// If user has presence_id, there is no need to get all numbers data, only main callflow
					if (user.presence_id) {
						self.usersGetMainCallflow(userId, function(mainCallflow) {
							waterfallCallback(null, {
								user: user,
								callflow: mainCallflow
							});
						});
						return;
					}

					// Otherwise, get user's numbers data
					self.usersGetFormattedNumbersData({
						userId: userId,
						callback: function(userNumbersData) {
							waterfallCallback(null, userNumbersData);
						}
					});
				},
				function(userData, waterfallCallback) {
					// Create voicemail box
					var user = userData.user,
						userFullName = monster.util.getUserFullName(user),
						mailbox = user.presence_id || _.head(userData.extensions);

					if (_.isNil(mailbox)) {
						// There is no extension to set for the mailbox
						waterfallCallback(true);
						return;
					}

					self.usersCreateVMBox({
						data: {
							data: self.usersNewMainVMBox(mailbox, userFullName, userId, args.deleteAfterNotify)
						},
						success: function(userVMBox) {
							waterfallCallback(null, userData, userVMBox);
						}
					});
				},
				function(userData, userVMBox, waterfallCallback) {
					var mainUserCallflow = userData.callflow;

					// Do not update main callflow if it does not has
					// been created by the voip app, or if does not have
					// empty children at the root of the flow, which
					// is the default main user callflow without vmbox
					if (mainUserCallflow.ui_metadata.origin !== 'voip' || !_.isEmpty(mainUserCallflow.flow.children)) {
						waterfallCallback(null);
						return;
					}

					// Otherwise, add vmbox to callflow
					mainUserCallflow.flow.children._ = {
						children: {},
						data: {
							id: userVMBox.id
						},
						module: 'voicemail'
					};

					self.usersUpdateCallflow(mainUserCallflow, function() {
						waterfallCallback(null);
					});
				}
			], function(err, result) {
				if (err) {
					args.hasOwnProperty('callback') && args.callback(err);
					return;
				}

				args.hasOwnProperty('callback') && args.callback(null);
			});
		},

		/**
		 * Gets a suitable main voicemail box for a Smart PBX user
		 * @param  {Object}   args
		 * @param  {Object}   args.user     User data
		 * @param  {Function} args.success  Success callback
		 * @param  {Function} args.error    Error callback
		 */
		usersGetSuitableMainVMBoxSmartUser: function(args) {
			var self = this,
				user = args.user;

			monster.waterfall([
				function(callback) {
					self.usersListVMBoxesUser({
						userId: user.id,
						success: function(vmboxes) {
							callback(null, self.usersGetUserMainVMBoxFromList(user, vmboxes));
						},
						error: function(parsedError) {
							callback(parsedError);
						}
					});
				},
				function(vmboxLite, callback) {
					if (!vmboxLite) {
						callback(null, null);
						return;
					}

					self.usersGetVMBox({
						data: {
							voicemailId: vmboxLite.id
						},
						success: function(vmbox) {
							callback(null, vmbox);
						}
					});
				}
			], function(err, vmbox) {
				if (err) {
					args.hasOwnProperty('error') && args.error(err);
					return;
				}

				args.hasOwnProperty('success') && args.success(vmbox);
			});
		},

		/**
		 * Gets the numbers data assigned to a user, separated in phone numbers and extensions
		 * @param  {Object}   args
		 * @param  {String}   args.userId             User ID
		 * @param  {Boolean}  args.loadAllExtensions  Indicates if all extensions should be loaded from API
		 * @param  {Boolean}  args.loadNumbersView    Indicates if the numbers view should be loaded
		 * @param  {Function} args.callback           Function to be called when the numbers data has been obtained and formatted
		 */
		usersGetFormattedNumbersData: function(args) {
			var self = this,
				loadAllExtensions = !!args.loadAllExtensions,
				callback = args.callback;

			self.usersGetNumbersData({
				userId: args.userId,
				loadUserDevices: !!args.loadNumbersView,
				loadAllCallflows: loadAllExtensions,
				callback: function(results) {
					self.usersFormatNumbersData({
						data: results,
						includeAllExtensions: loadAllExtensions,
						callback: callback
					});
				}
			});
		},

		/**
		 * Gets the list of vmboxes for a user
		 * @param  {Object}   args
		 * @param  {String}   args.userId   User ID
		 * @param  {Function} args.success  Success callback
		 * @param  {Function} args.error    Error callback
		 */
		usersListVMBoxesUser: function(args) {
			var self = this;

			self.usersListVMBoxes({
				data: {
					filters: {
						filter_owner_id: args.userId
					}
				},
				success: args.success
			});
		},

		/**
		 * Update specific values of a user
		 * @param  {Object}   args
		 * @param  {Object}   args.data         Data to be sent by the SDK to the API
		 * @param  {String}   args.data.userId  ID of the user to be patched
		 * @param  {Object}   args.data.data    User data to be patched
		 * @param  {Function} args.success      Success callback
		 * @param  {Function} args.error        Error callback
		 */
		usersPatchUser: function(args) {
			var self = this;

			self.callApi({
				resource: 'user.patch',
				data: _.merge({
					accountId: self.accountId
				}, args.data),
				success: function(data, status) {
					args.hasOwnProperty('success') && args.success(data.data);
				},
				error: function(parsedError) {
					args.hasOwnProperty('error') && args.error(parsedError);
				}
			});
		},

		/**
		 * Update specific values of a voicemail box
		 * @param  {Object}   args
		 * @param  {Object}   args.data              Data to be sent by the SDK to the API
		 * @param  {String}   args.data.voicemailId  ID of the voicemail box to be patched
		 * @param  {Object}   args.data.data         Voicemail box data to be patched
		 * @param  {Function} args.success           Success callback
		 * @param  {Function} args.error             Error callback
		 */
		usersPatchVMBox: function(args) {
			var self = this;

			self.callApi({
				resource: 'voicemail.patch',
				data: _.merge({
					accountId: self.accountId
				}, args.data),
				success: function(data, status) {
					args.hasOwnProperty('success') && args.success(data.data);
				},
				error: function(parsedError) {
					args.hasOwnProperty('error') && args.error(parsedError);
				}
			});
		},

		/**
		 * Get the main VMBox for a user, from a list of voicemail boxes, which are assumed to
		 * belong to it already
		 * @param  {Object} user     User data
		 * @param  {Array}  vmboxes  List of voicemail boxes that belong to the user
		 */
		usersGetUserMainVMBoxFromList: function(user, vmboxes) {
			if (_.isEmpty(vmboxes)) {
				return null;
			}

			var presenceId = user.presence_id ? user.presence_id.toString() : null,
				mainUserVMBox = _.find(vmboxes, function(vmbox) {
					return vmbox.mailbox === presenceId;
				});

			if (mainUserVMBox) {
				return mainUserVMBox;
			}

			return _.head(vmboxes);
		},

		/**
		 * Gets a new Voicemail Box object
		 * @param    {Number}  mailbox              Mailbox
		 * @param    {String}  userName             User full name
		 * @param    {String}  [userId]             User ID
		 * @param    {Boolean} [deleteAfterNotify]  Delete voicemail message after notify user
		 * @returns  {Object}  Voicemail Box object
		 */
		usersNewMainVMBox: function(mailbox, userName, userId, deleteAfterNotify) {
			var self = this;

			return {
				owner_id: userId,
				mailbox: mailbox.toString(),	// Force to string
				name: self.usersGetMainVMBoxName(userName),
				delete_after_notify: deleteAfterNotify
			};
		},

		/**
		 * Builds the name for the user's main voicemail box
		 * @param    {String} userName  User full name
		 * @returns  {String} Name for the user's main voicemail box
		 */
		usersGetMainVMBoxName: function(userName) {
			var self = this;

			return userName + self.appFlags.users.smartPBXVMBoxString;
		},

		/**
		 * Extracts a module node or a module value (if path is provided) from a callflow's
		 * default flow tree.
		 * @param  {Object} args
		 * @param  {Object} args.callflow    Callflow object
		 * @param  {Object} args.module      Callflow module name
		 * @param  {Object} [args.dataPath]  Optional path of data to extract within the module.
		 * @returns {Any}   Value extracted from the callflow, or undefined if the module or path
		 *                  is not found
		 */
		usersExtractDataFromCallflow: function(args) {
			var self = this,
				flow = _.get(args, 'callflow.flow'),
				cfModule = args.module;

			if (_.isNil(flow)) {
				return undefined;
			}

			while (flow.module !== cfModule && _.has(flow.children, '_')) {
				flow = flow.children._;
			}

			if (flow.module !== cfModule) {
				return undefined;
			} else if (_.has(args, 'dataPath')) {
				return _.get(flow, args.dataPath);
			} else {
				return flow;
			}
		},

		/**
		 * Extracts the vmbox ID from a user mai callflow
		 * @param  {Object} args
		 * @param  {Object} args.userMainCallflow  User's main callflow
		 * @returns  {String}                      Voicemail box ID
		 */
		usersExtractVMBoxIdFromCallflow: function(args) {
			var self = this;

			return self.usersExtractDataFromCallflow({
				callflow: args.userMainCallflow,
				module: 'voicemail',
				dataPath: 'data.id'
			});
		},

		/**
		 * Gets a user main callflow and main vmbox
		 * @param  {Object}   args
		 * @param  {Object}   args.userId     User ID
		 * @param  {Function} [args.success]  Optional success callback
		 * @param  {Function} [args.error]    Optional error callback
		 */
		usersGetMainCallflowAndVMBox: function(args) {
			var self = this;

			monster.waterfall([
				function(waterfallCallback) {
					self.usersGetMainCallflow(args.userId, function(callflow) {
						waterfallCallback(null, callflow);
					});
				},
				function(callflow, waterfallCallback) {
					var vmboxId = self.usersExtractVMBoxIdFromCallflow({
						userMainCallflow: callflow
					});

					if (!vmboxId) {
						waterfallCallback(null, null, {
							callflow: callflow
						});
						return;
					}

					self.usersGetVMBox({
						data: {
							voicemailId: vmboxId,
							generateError: false
						},
						success: function(vmbox) {
							waterfallCallback(null, null, {
								callflow: callflow,
								vmbox: vmbox
							});
						},
						error: function(parsedError, error, globalHandler) {
							if (error.status === 404) {
								waterfallCallback(null, vmboxId, {
									callflow: callflow
								});
							} else {
								globalHandler(parsedError, { generateError: true });
								waterfallCallback(true);
							}
						}
					});
				},
				function(vmboxIdNotFound, data, waterfallCallback) {
					if (!vmboxIdNotFound) {
						waterfallCallback(null, data);
						return;
					}

					// VMBox no longer exists, so purge it from main callflow
					monster.pub('voip.vmboxes.removeCallflowModule', {
						callflow: data.callflow,
						module: 'voicemail',
						dataId: vmboxIdNotFound,
						success: function() {
							waterfallCallback(null, data);
						},
						error: function() {
							waterfallCallback(true);
						}
					});
				}
			], function(err, results) {
				if (err) {
					_.has(args, 'error') && args.error(err);
				} else {
					_.has(args, 'success') && args.success(results);
				}
			});
		},

		/**
		 * Update VMBox module status in callflow, to be enabled or skipped
		 * @param  {Object}   args
		 * @param  {String}   args.userId    User ID
		 * @param  {Boolean}  args.enabled   Indicates if vmbox module should be enabled or skipped
		 * @param  {Function} args.callback  Asynchronous callback
		 */
		usersUpdateVMBoxStatusInCallflow: function(args) {
			var self = this,
				userId = args.userId,
				enabled = args.enabled,
				callback = args.callback;

			monster.waterfall([
				function(waterfallCallback) {
					self.usersGetMainCallflow(userId, function(callflow) {
						waterfallCallback(null, callflow);
					});
				},
				function(callflow, waterfallCallback) {
					var flow = self.usersExtractDataFromCallflow({
						callflow: callflow,
						module: 'voicemail'
					});

					if (flow) {
						// Module already exists in callflow
						flow.data.skip_module = !enabled;

						self.usersUpdateCallflow(callflow, function() {
							waterfallCallback(null);
						});
					} else {
						// Module does not exist in callflow, but should, so err
						waterfallCallback(true);
					}
				}
			], callback);
		}
	};

	return app;
});
