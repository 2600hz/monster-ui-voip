define(function(require){
	var $ = require('jquery'),
		_ = require('underscore'),
		monster = require('monster'),
		timezone = require('monster-timezone'),
		toastr = require('toastr');

	var app = {

		requests: {
		},

		subscribe: {
			'voip.groups.render': 'groupsRender'
		},

		/* Users */
		/* args: parent and groupId */
		groupsRender: function(args) {
			var self = this,
				args = args || {},
				parent = args.parent || $('.right-content'),
				_groupId = args.groupId,
				callback = args.callback,
				noGroup = true;

			self.groupsRemoveOverlay();

			self.groupsGetData(function(data) {
				var hasOldData = _.find(data.callflows, function(callflow) {
					return !callflow.hasOwnProperty('type');
				});

				if(hasOldData) {
					monster.ui.alert('error', self.i18n.active().groups.outdatedGroupsError);
				} else {
					var dataTemplate = self.groupsFormatListData(data),
						countGroups = _.size(dataTemplate.groups),
						template = $(monster.template(self, 'groups-layout', { countGroups: countGroups })),
						templateGroup;

					_.each(dataTemplate.groups, function(group) {
						templateGroup = monster.template(self, 'groups-row', group);

						template.find('.groups-rows').append(templateGroup);
					});

					self.groupsBindEvents(template, parent);

					parent
						.empty()
						.append(template);

					self.groupsCheckWalkthrough();

					if(_groupId) {
						var cells =  parent.find('.grid-row[data-id=' + _groupId + '] .grid-cell');

						monster.ui.highlight(cells);
					}

					if ( countGroups === 0 ) {
						parent.find('.grid-row.title').css('display', 'none');
						parent.find('.no-groups-row').css('display', 'block');
					} else {
						parent.find('.grid-row.title').css('display', 'block');
						parent.find('.no-groups-row').css('display', 'none');
					}

					callback && callback();
				}
			});
		},

		groupsFormatListData: function(data) {
			var self = this,
				mapGroups = {},
				arrayGroups = [];

			_.each(data.groups, function(group) {
				mapGroups[group.id] = group;

				mapGroups[group.id].extra = self.groupsGetGroupFeatures(group);
			});

			_.each(data.callflows, function(callflow) {
				if(callflow.group_id in mapGroups) {
					if(callflow.type === 'userGroup') {
						var listExtensions = [],
							listNumbers = [];

						_.each(callflow.numbers, function(number) {
							number.length < 7 ? listExtensions.push(number) : listNumbers.push(number);
						});

						mapGroups[callflow.group_id].extra.listCallerId = [];

						if(listExtensions.length > 0) {
							mapGroups[callflow.group_id].extra.extension = listExtensions[0];

							_.each(listExtensions, function(number) {
								mapGroups[callflow.group_id].extra.listCallerId.push(number);
							});
						}
						mapGroups[callflow.group_id].extra.additionalExtensions = listExtensions.length > 1;

						if(listNumbers.length > 0) {
							mapGroups[callflow.group_id].extra.mainNumber = listNumbers[0];

							_.each(listNumbers, function(number) {
								mapGroups[callflow.group_id].extra.listCallerId.push(number);
							});
						}
						mapGroups[callflow.group_id].extra.additionalNumbers = listNumbers.length > 1;
						mapGroups[callflow.group_id].extra.callflowId = callflow.id;
					} else if(callflow.type === 'baseGroup') {
						mapGroups[callflow.group_id].extra.baseCallflowId = callflow.id;
					}
				}
			});

			_.each(mapGroups, function(group) {
				arrayGroups.push(group);
			});

			arrayGroups.sort(function(a,b) {
				return a.name > b.name ? 1 : -1;
			});

			data.groups = arrayGroups;

			return data;
		},

		groupsGetGroupFeatures: function(group) {
			var self = this,
				result = {
					mapFeatures: {
						call_recording: {
							icon: 'fa fa-microphone',
							iconColor: 'monster-primary-color',
							title: self.i18n.active().groups.callRecording.title
						},
						ringback: {
							icon: 'fa fa-music',
							iconColor: 'monster-yellow',
							title: self.i18n.active().groups.ringback.title
						},
						next_action: {
							icon: 'fa fa-arrow-right',
							iconColor: 'monster-green',
							title: self.i18n.active().groups.nextAction.title
						},
						forward: {
							icon: 'fa fa-mail-forward',
							iconColor: 'monster-orange',
							title: self.i18n.active().groups.forward.title
						},
						prepend: {
							icon: 'fa fa-file-text-o',
							iconColor: 'monster-pink',
							title: self.i18n.active().groups.prepend.title
						}
					},
					hasFeatures: false
				};

			_.each(result.mapFeatures, function(val, key) {
				if(('features' in group && group.features.indexOf(key) >= 0) // If data from view
				|| ('smartpbx' in group && key in group.smartpbx && group.smartpbx[key].enabled)) { // If data from document
					val.active = true;
					result.hasFeatures = true;
				}
			});

			return result;
		},

		groupsBindEvents: function(template, parent) {
			var self = this;

			setTimeout(function() { template.find('.search-query').focus(); });

			monster.ui.tooltips(template, {
				options: {
					container: 'body'
				}
			});

			template.find('.grid-row:not(.title) .grid-cell').on('click', function() {
				var cell = $(this),
					type = cell.data('type'),
					row = cell.parents('.grid-row'),
					groupId = row.data('id');

				template.find('.edit-groups').slideUp("400", function() {
					$(this).empty();
				});

				if(cell.hasClass('active')) {
					template.find('.grid-cell').removeClass('active');
					template.find('.grid-row').removeClass('active');

					self.groupsRemoveOverlay();
					cell.css({
						'position': 'inline-block',
						'z-index': '0'
					});

					cell.parent().siblings('.edit-groups').css({
						'position': 'block',
						'z-index': '0',
						'border-top-color': '#a6a7a9'
					});
				}
				else {
					template.find('.grid-cell').removeClass('active');
					template.find('.grid-row').removeClass('active');
					cell.toggleClass('active');
					row.toggleClass('active');

					cell.css({
						'position': 'relative',
						'z-index': '2'
					});

					cell.parents('.groups-cells').siblings('.edit-groups').css({
						'position': 'relative',
						'z-index': '2',
						'border-top-color': 'transparent'
					});

					self.groupsGetTemplate(type, groupId, function(template, data) {
						monster.ui.tooltips(template);

						row.find('.edit-groups').append(template).slideDown();

						$('body').append($('<div id="groups_container_overlay"></div>'));
					});
				}
			});

			template.find('.groups-header .search-query').on('keyup', function() {
				var searchString = $(this).val().toLowerCase(),
					rows = template.find('.groups-rows .grid-row:not(.title)'),
					emptySearch = template.find('.groups-rows .empty-search-row');

				_.each(rows, function(row) {
					var $row = $(row);

					$row.data('search').toLowerCase().indexOf(searchString) < 0 ? $row.hide() : $row.show();
				});

				if(rows.size() > 0) {
					rows.is(':visible') ? emptySearch.hide() : emptySearch.show();
				}
			});

			template.on('click', '.cancel-link', function() {
				template.find('.edit-groups').slideUp("400", function() {
					$(this).empty();
					template.find('.grid-cell.active').css({
						'position': 'inline-block',
						'z-index': '0'
					});
					template.find('.grid-row.active .edit-groups').css({
						'position': 'block',
						'z-index': '0'
					});
					template.find('.grid-row.active').removeClass('active');
					self.groupsRemoveOverlay();

					template.find('.grid-cell.active').removeClass('active');
				});
			});

			template.find('.groups-header .add-group').on('click', function() {
				self.groupsGetCreationData(function(data) {
					var groupTemplate = $(monster.template(self, 'groups-creation', data)),
						groupForm = groupTemplate.find('#form_group_creation');

					monster.ui.validate(groupForm);
					monster.ui.mask(groupForm.find('#inputExtension'), 'extension');

					groupTemplate.find('#create_group').on('click', function() {
						if(monster.ui.valid(groupForm)) {
							var formattedData = self.groupsCreationMergeData(data, groupTemplate);

							if(!_.isEmpty(formattedData.group.endpoints)) {
								self.groupsCreate(formattedData, function(data) {
									popup.dialog('close').remove();

									self.groupsRender({ groupId: data.id });
								});
							}
							else {
								monster.ui.alert('warning', self.i18n.active().groups.emptyEndpointsWarning);
							}
						}
					});

					groupTemplate.find('#group_user_selector .selected-users, #group_user_selector .available-users').sortable({
						connectWith: '.connectedSortable'
					}).disableSelection();

					var popup = monster.ui.dialog(groupTemplate, {
						title: self.i18n.active().groups.dialogCreationGroup.title
					});
				});
			});

			$('body').on('click', '#groups_container_overlay', function() {
				template.find('.edit-groups').slideUp("400", function() {
					$(this).empty();
				});

				self.groupsRemoveOverlay();

				template.find('.grid-cell.active').css({
					'position': 'inline-block',
					'z-index': '0'
				});

				template.find('.grid-row.active').parent().siblings('.edit-groups').css({
					'position': 'block',
					'z-index': '0'
				});

				template.find('.grid-cell.active').removeClass('active');
				template.find('.grid-row.active').removeClass('active');
			});
		},

		groupsCreationMergeData: function(data, template) {
			var formData = monster.ui.getFormData('form_group_creation'),
				fixedTimeout = '20',
				fixedDelay = '0',
				settings = {
					timeout: fixedTimeout,
					delay: fixedDelay,
					endpoint_type: 'user'
				},
				listUserRingGroup = [],
				listUserGroup = {};

			template.find('.selected-users li').each(function() {
				var userId = $(this).data('user_id'),
					ringGroupUser = $.extend(true, {}, settings, { id: userId });

				listUserGroup[userId] = { type: 'user' };
				listUserRingGroup.push(ringGroupUser);
			});

			var formattedData = {
				group: {
					name: formData.name,
					endpoints: listUserGroup
				},
				baseCallflow: {
					numbers: [ monster.util.randomString(25) ],
					name: formData.name + ' Base Group',
					flow: {
						module: 'ring_group',
						children: {},
						data: {
							strategy: 'simultaneous',
							timeout: parseInt(fixedTimeout) + parseInt(fixedDelay),
							endpoints: listUserRingGroup
						}
					},
					type: 'baseGroup'
				},
				callflow: {
					numbers: [ formData.extra.extension ],
					name: formData.name + ' Ring Group',
					flow: {
						module: 'callflow',
						children: {
							'_': {
								module: 'play',
								children: {},
								data: {
									id: 'system_media/vm-not_available_no_voicemail'
								}
							}
						},
						data: {
							id: ''
						}
					},
					type: 'userGroup'
				}
			};

			return formattedData;
		},

		groupsGetTemplate: function(type, groupId, callbackAfterData) {
			var self = this,
				template;

			if(type === 'name') {
				self.groupsGetNameTemplate(groupId, callbackAfterData);
			}
			else if(type === 'numbers') {
				self.groupsGetNumbersTemplate(groupId, callbackAfterData);
			}
			else if(type === 'extensions') {
				self.groupsGetExtensionsTemplate(groupId, callbackAfterData);
			}
			else if(type === 'features') {
				self.groupsGetFeaturesTemplate(groupId, callbackAfterData);
			}
			else if(type === 'members') {
				self.groupsGetMembersTemplate(groupId, callbackAfterData);
			}
		},

		groupsGetFeaturesTemplate: function(groupId, callback) {
			var self = this;

			self.groupsGetFeaturesData(groupId, function(data) {
				template = $(monster.template(self, 'groups-features', data.group));

				self.groupsBindFeatures(template, data);

				callback && callback(template, data);
			});
		},

		groupsGetNameTemplate: function(groupId, callback) {
			var self = this;

			self.groupsGetNameData(groupId, function(data) {
				template = $(monster.template(self, 'groups-name', data));

				self.groupsBindName(template, data);

				callback && callback(template, data);
			});
		},

		groupsGetNumbersTemplate: function(groupId, callback) {
			var self = this;

			self.groupsGetNumbersData(groupId, function(data) {
				self.groupsFormatNumbersData(data, function(data) {
					template = $(monster.template(self, 'groups-numbers', data));

					_.each(data.assignedNumbers, function(numberData, numberId) {
						numberData.phoneNumber = numberId;

						var numberDiv = template.find('[data-id="' + numberId + '"]'),
							argsFeatures = {
								target: numberDiv.find('.edit-features'),
								numberData: numberData,
								afterUpdate: function(features) {
									monster.ui.paintNumberFeaturesIcon(features, numberDiv.find('.features'));
								}
							};

						monster.pub('common.numberFeaturesMenu.render', argsFeatures);
					});

					self.groupsBindNumbers(template, data);

					callback && callback(template, data);
				});
			});
		},

		groupsGetExtensionsTemplate: function(groupId, callback) {
			var self = this;

			self.groupsGetNumbersData(groupId, function(data) {
				self.groupsFormatNumbersData(data, function(data) {
					template = $(monster.template(self, 'groups-extensions', data));

					self.groupsBindExtensions(template, data);

					callback && callback(template, data);
				});
			});
		},

		groupsGetMembersTemplate: function(groupId, callback) {
			var self = this;

			self.groupsGetMembersData(groupId, function(results) {
				var results = self.groupsFormatMembersData(results);

				template = $(monster.template(self, 'groups-members', results));

				monster.pub('common.ringingDurationControl.render', {
					container: template.find('.members-container'),
					endpoints: results.extra.ringGroup,
					hasRemoveColumn: true
				});

				self.groupsBindMembers(template, results);

				callback && callback(template, results);
			});
		},

		groupsBindFeatures: function(template, data) {
			var self = this;

			template.find('.feature[data-feature="call_recording"]').on('click', function() {
				self.groupsRenderCallRecording(data);
			});

			template.find('.feature[data-feature="ringback"]').on('click', function() {
				self.groupsRenderRingback(data);
			});

			template.find('.feature[data-feature="next_action"]').on('click', function() {
				self.groupsRenderNextAction(data);
			});

			template.find('.feature[data-feature="forward"]').on('click', function() {
				self.groupsRenderForward(data);
			});

			template.find('.feature[data-feature="prepend"]').on('click', function() {
				self.groupsRenderPrepend(data);
			});
		},

		groupsRenderCallRecording: function(data) {
			var self = this,
				recordCallNode = monster.util.findCallflowNode(data.callflow, 'record_call'),
				templateData = $.extend(true, {
												group: data.group
											},
											(data.group.extra.mapFeatures.call_recording.active && recordCallNode ? {
												url: recordCallNode.data.url,
												format: recordCallNode.data.format,
												timeLimit: recordCallNode.data.time_limit
											} : {})
										),
				featureTemplate = $(monster.template(self, 'groups-feature-call_recording', templateData)),
				switchFeature = featureTemplate.find('.switch-state'),
				featureForm = featureTemplate.find('#call_recording_form'),
				popup;

			monster.ui.validate(featureForm, {
				rules: {
					'time_limit': {
						digits: true
					}
				}
			});

			featureTemplate.find('.cancel-link').on('click', function() {
				popup.dialog('close').remove();
			});

			switchFeature.on('change', function() {
				$(this).prop('checked') ? featureTemplate.find('.content').slideDown() : featureTemplate.find('.content').slideUp();
			});

			featureTemplate.find('.save').on('click', function() {
				if(monster.ui.valid(featureForm)) {
					var formData = monster.ui.getFormData('call_recording_form'),
						enabled = switchFeature.prop('checked');

					if(!('smartpbx' in data.group)) { data.group.smartpbx = {}; }
					if(!('call_recording' in data.group.smartpbx)) {
						data.group.smartpbx.call_recording = {
							enabled: false
						};
					}

					if(data.group.smartpbx.call_recording.enabled || enabled) {
						data.group.smartpbx.call_recording.enabled = enabled;
						var newCallflow = $.extend(true, {}, data.callflow),
							currentNode = monster.util.findCallflowNode(newCallflow, 'record_call') || monster.util.findCallflowNode(newCallflow, 'callflow');
						if(enabled) {

							if(currentNode.module === 'record_call') {
								currentNode.data = $.extend(true, { action: "start" }, formData);
							} else {
								currentNode.children = {
									"_": $.extend(true, {}, currentNode)
								};
								currentNode.module = "record_call";
								currentNode.data = $.extend(true, { action: "start" }, formData);
							}
						} else if(currentNode.module === 'record_call') {
							currentNode.module = currentNode.children["_"].module;
							currentNode.data = currentNode.children["_"].data;
							currentNode.children = currentNode.children["_"].children;
						}
						self.groupsUpdateCallflow(newCallflow, function(updatedCallflow) {
							self.groupsUpdate(data.group, function(updatedGroup) {
								popup.dialog('close').remove();
								self.groupsRender({ groupId: data.group.id });
							});
						});
					} else {
						popup.dialog('close').remove();
						self.groupsRender({ groupId: data.group.id });
					}
				}
			});

			popup = monster.ui.dialog(featureTemplate, {
				title: data.group.extra.mapFeatures.call_recording.title,
				position: ['center', 20]
			});
		},

		groupsRenderRingback: function(data) {
			var self = this,
				silenceMediaId = 'silence_stream://300000',
				ringGroupNode = data.baseCallflow.flow,
				mediaToUpload = undefined;

			while(ringGroupNode.module !== 'ring_group' && '_' in ringGroupNode.children) {
				ringGroupNode = ringGroupNode.children['_'];
			}

			self.groupsListMedias(function(medias) {
				var templateData = {
						group: data.group,
						silenceMedia: silenceMediaId,
						mediaList: medias,
						media: ringGroupNode.data.ringback || ''
					},
					featureTemplate = $(monster.template(self, 'groups-feature-ringback', templateData)),
					switchFeature = featureTemplate.find('.switch-state'),
					popup,
					closeUploadDiv = function(newMedia) {
						mediaToUpload = undefined;
						featureTemplate.find('.upload-div input').val('');
						featureTemplate.find('.upload-div').slideUp(function() {
							featureTemplate.find('.upload-toggle').removeClass('active');
						});
						if(newMedia) {
							var mediaSelect = featureTemplate.find('.media-dropdown');
							mediaSelect.append('<option value="'+newMedia.id+'">'+newMedia.name+'</option>');
							mediaSelect.val(newMedia.id);
						}
					};

				featureTemplate.find('.upload-input').fileUpload({
					inputOnly: true,
					wrapperClass: 'file-upload input-append',
					btnText: self.i18n.active().groups.ringback.audioUploadButton,
					btnClass: 'monster-button',
					maxSize: 5,
					success: function(results) {
						mediaToUpload = results[0];
					},
					error: function(errors) {
						if(errors.hasOwnProperty('size') && errors.size.length > 0) {
							monster.ui.alert(self.i18n.active().groups.ringback.fileTooBigAlert);
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
					if($(this).hasClass('active')) {
						featureTemplate.find('.upload-div').stop(true, true).slideUp();
					} else {
						featureTemplate.find('.upload-div').stop(true, true).slideDown();
					}
				});

				featureTemplate.find('.upload-cancel').on('click', function() {
					closeUploadDiv();
				});

				featureTemplate.find('.upload-submit').on('click', function() {
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
						monster.ui.alert(self.i18n.active().groups.ringback.emptyUploadAlert);
					}
				});

				featureTemplate.find('.save').on('click', function() {
					var selectedMedia = featureTemplate.find('.media-dropdown option:selected').val(),
						enabled = switchFeature.prop('checked');

					if(!('smartpbx' in data.group)) {
						data.group.smartpbx = {};
					}

					if(enabled) {
						ringGroupNode.data.ringback = selectedMedia;
						if('ringback' in data.group.smartpbx) {
							data.group.smartpbx.ringback.enabled = true;
						} else {
							data.group.smartpbx.ringback = {
								enabled: true
							};
						}

						self.groupsUpdateCallflow(data.baseCallflow, function() {
							self.groupsUpdate(data.group, function(updatedGroup) {
								popup.dialog('close').remove();
								self.groupsRender({ groupId: data.group.id });
							});
						});
					} else if(ringGroupNode.data.ringback || (data.group.smartpbx.ringback && data.group.smartpbx.ringback.enabled)) {
						delete ringGroupNode.data.ringback;
						if('ringback' in data.group.smartpbx) {
							data.group.smartpbx.ringback.enabled = false;
						}

						self.groupsUpdateCallflow(data.baseCallflow, function() {
							self.groupsUpdate(data.group, function(updatedGroup) {
								popup.dialog('close').remove();
								self.groupsRender({ groupId: data.group.id });
							});
						});
					}
				});

				popup = monster.ui.dialog(featureTemplate, {
					title: data.group.extra.mapFeatures.ringback.title,
					position: ['center', 20]
				});
			});
		},

		groupsRenderNextAction: function(data) {
			var self = this,
				flow = data.callflow.flow,
				selectedEntity = null;

			while(flow.module != 'callflow') {
				flow = flow.children['_']; 
			} //Go to the first callflow (i.e. base ring group)
			if('_' in flow.children) {
				selectedEntity = flow.children['_'].data.id;
			} //Find the existing Next Action if there is one


			var templateData = $.extend(true, {selectedEntity: selectedEntity}, data),
				featureTemplate = $(monster.template(self, 'groups-feature-next_action', templateData)),
				switchFeature = featureTemplate.find('.switch-state'),
				popup;

			featureTemplate.find('.cancel-link').on('click', function() {
				popup.dialog('close').remove();
			});

			switchFeature.on('change', function() {
				$(this).prop('checked') ? featureTemplate.find('.content').slideDown() : featureTemplate.find('.content').slideUp();
			});

			featureTemplate.find('.save').on('click', function() {
				var selectedOption = featureTemplate.find('.next-action-select option:selected'),
					enabled = switchFeature.prop('checked');

				if(!('smartpbx' in data.group)) { data.group.smartpbx = {}; }
				if(!('next_action' in data.group.smartpbx)) {
					data.group.smartpbx.next_action = {
						enabled: false
					};
				}

				if(data.group.smartpbx.next_action.enabled || enabled) {
					data.group.smartpbx.next_action.enabled = enabled;
					var newCallflow = $.extend(true, {}, data.callflow),
						callflowNode = monster.util.findCallflowNode(newCallflow, 'callflow');

					if(_.isArray(callflowNode)) {
						callflowNode = callflowNode[0];
					}

					callflowNode.children = {};
					if(enabled) {
						callflowNode.children['_'] = {
							children: {},
							module: selectedOption.data('module'),
							data: { id: selectedOption.val() }
						}
					} else {
						callflowNode.children['_'] = {
							module: 'play',
							children: {},
							data: {
								id: 'system_media/vm-not_available_no_voicemail'
							}
						};
					}
					self.groupsUpdateCallflow(newCallflow, function(updatedCallflow) {
						self.groupsUpdate(data.group, function(updatedGroup) {
							popup.dialog('close').remove();
							self.groupsRender({ groupId: data.group.id });
						});
					});
				} else {
					popup.dialog('close').remove();
					self.groupsRender({ groupId: data.group.id });
				}
			});

			popup = monster.ui.dialog(featureTemplate, {
				title: data.group.extra.mapFeatures.next_action.title,
				position: ['center', 20]
			});
		},

		groupsRenderForward: function(data) {
			var self = this,
				featureTemplate = $(monster.template(self, 'groups-feature-forward', data)),
				switchFeature = featureTemplate.find('.switch-state'),
				popup;

			featureTemplate.find('.cancel-link').on('click', function() {
				popup.dialog('close').remove();
			});

			featureTemplate.find('.save').on('click', function() {
				var enabled = switchFeature.prop('checked'),
					ignore_forward = !enabled;

				data.group.smartpbx = data.group.smartpbx || {};
				data.group.smartpbx.forward = data.group.smartpbx.forward || {};
				data.group.smartpbx.forward.enabled = enabled;
				data.group.ignore_forward = ignore_forward;
				data.baseCallflow.flow.data.ignore_forward = ignore_forward;

				monster.parallel({
						groups: function(callback) {
							self.groupsUpdate(data.group, function(updatedGroup) {
								callback(null, updatedGroup);
							});
						},
						ringGroup: function(callback) {
							self.groupsUpdateCallflow(data.baseCallflow, function(callflow) {
								callback(null, callflow);
							});
						}
					},
					function(err, results) {
						popup.dialog('close').remove();
						self.groupsRender({ groupId: results.groups.id });
					}
				);
			});

			popup = monster.ui.dialog(featureTemplate, {
				title: data.group.extra.mapFeatures.forward.title,
				position: ['center', 20]
			});
		},

		groupsRenderPrepend: function(data) {
			var self = this,
				prependNode = monster.util.findCallflowNode(data.callflow, 'prepend_cid'),
				templateData = $.extend(true, {
												group: data.group
											},
											(data.group.extra.mapFeatures.prepend.active && prependNode ? {
												caller_id_name_prefix: prependNode.data.caller_id_name_prefix,
												caller_id_number_prefix: prependNode.data.caller_id_number_prefix
											} : {})
										),
				featureTemplate = $(monster.template(self, 'groups-feature-prepend', templateData)),
				switchFeature = featureTemplate.find('.switch-state'),
				popup;

			featureTemplate.find('.cancel-link').on('click', function() {
				popup.dialog('close').remove();
			});

			switchFeature.on('change', function() {
				$(this).prop('checked') ? featureTemplate.find('.content').slideDown() : featureTemplate.find('.content').slideUp();
			});

			featureTemplate.find('.save').on('click', function() {
				var enabled = switchFeature.prop('checked'),
					prependData = $.extend(true, { action: 'prepend' }, monster.ui.getFormData('prepend_form'));

				if(!('smartpbx' in data.group)) { data.group.smartpbx = {}; }
				if(!('prepend' in data.group.smartpbx)) {
					data.group.smartpbx.prepend = {
						enabled: false
					};
				}

				if(data.group.smartpbx.prepend.enabled || enabled) {
					data.group.smartpbx.prepend.enabled = enabled;
					var newCallflow = $.extend(true, {}, data.callflow);
					if(enabled) {
						if(newCallflow.flow.module !== 'prepend_cid') {
							newCallflow.flow = {
								children: {
									'_': $.extend(true, {}, data.callflow.flow)
								},
								module: 'prepend_cid',
								data: prependData
							}
						}
						else {
							newCallflow.flow.data = prependData;
						}
					} else {
						if(prependNode) {
							newCallflow.flow = $.extend(true, {}, prependNode.children["_"]);
						}
					}
					self.groupsUpdateCallflow(newCallflow, function(updatedCallflow) {
						self.groupsUpdate(data.group, function(updatedGroup) {
							popup.dialog('close').remove();
							self.groupsRender({ groupId: data.group.id });
						});
					});
				} else {
					popup.dialog('close').remove();
					self.groupsRender({ groupId: data.group.id });
				}
			});

			popup = monster.ui.dialog(featureTemplate, {
				title: data.group.extra.mapFeatures.prepend.title,
				position: ['center', 20]
			});
		},

		groupsBindName: function(template, data) {
			var self = this,
				nameForm = template.find('#form-name');

			monster.ui.validate(nameForm);

			template.find('.save-group').on('click', function() {
				if(monster.ui.valid(nameForm)) {
					var formData = monster.ui.getFormData('form-name');

					//formData = self.groupsCleanNameData(formData);

					data = $.extend(true, {}, data, formData);

					self.groupsUpdate(data, function(data) {
						self.groupsRender({ groupId: data.id });
					});
				}
			});

			template.find('.delete-group').on('click', function() {
				monster.ui.confirm(self.i18n.active().groups.confirmDeleteGroup, function() {
					self.groupsDelete(data.id, function(data) {
						toastr.success(monster.template(self, '!' + self.i18n.active().groups.groupDeleted, { name: data.group.name }));

						self.groupsRender();
					});
				});
			});
		},

		groupsBindNumbers: function(template, data) {
			var self = this,
				toastrMessages = self.i18n.active().groups.toastrMessages,
				currentNumberSearch = '',
				extraSpareNumbers = [];

			// template.on('click', '.list-assigned-items .remove-number', function() {
			// 	var row = $(this).parents('.item-row'),
			// 		spare = template.find('.count-spare'),
			// 		countSpare = spare.data('count') + 1,
			// 		unassignedList = template.find('.list-unassigned-items');

			// 	/* Alter the html */
			// 	row.hide();

			// 	row.find('button')
			// 		.removeClass('remove-number btn-danger')
			// 		.addClass('add-number btn-primary')
			// 		.text(self.i18n.active().add);

			// 	unassignedList.append(row);
			// 	unassignedList.find('.empty-row').hide();

			// 	spare
			// 		.html(countSpare)
			// 		.data('count', countSpare);

			// 	var rows = template.find('.list-assigned-items .item-row');
			// 	/* If no rows beside the clicked one, display empty row */
			// 	if(rows.is(':visible') === false) {
			// 		template.find('.list-assigned-items .empty-row').show();
			// 	}

			// 	/* If it matches the search string, show it */
			// 	if(row.data('search').indexOf(currentNumberSearch) >= 0) {
			// 		row.show();
			// 		unassignedList.find('.empty-search-row').hide();
			// 	}
			// });

			template.on('click', '.list-assigned-items .remove-number', function() {
				var $this = $(this),
					row = $this.parents('.item-row');

				extraSpareNumbers.push(row.data('id'));

				row.slideUp(function() {
					row.remove();

					if ( !template.find('.list-assigned-items .item-row').is(':visible') ) {
						template.find('.list-assigned-items .empty-row').slideDown();
					}

					template.find('.spare-link').removeClass('disabled');
				});
			});

			template.on('keyup', '.list-wrapper .unassigned-list-header .search-query', function() {
				var rows = template.find('.list-unassigned-items .item-row'),
					emptySearch = template.find('.list-unassigned-items .empty-search-row'),
					currentRow;

				currentNumberSearch = $(this).val().toLowerCase();

				_.each(rows, function(row) {
					currentRow = $(row);
					currentRow.data('search').toLowerCase().indexOf(currentNumberSearch) < 0 ? currentRow.hide() : currentRow.show();
				});

				if(rows.size() > 0) {
					rows.is(':visible') ? emptySearch.hide() : emptySearch.show();
				}
			});

			template.on('click', '.actions .spare-link:not(.disabled)', function(e) {
				e.preventDefault();

				var $this = $(this),
					args = {
					accountName: monster.apps['auth'].currentAccount.name,
					accountId: self.accountId,
					ignoreNumbers: $.map(template.find('.item-row'), function(row) {
						return $(row).data('id');
					}),
					extraNumbers: extraSpareNumbers,
					callback: function(numberList, remainingQuantity) {
						template.find('.empty-row').hide();

						_.each(numberList, function(val, idx) {
							template
								.find('.list-assigned-items')
								.append($(monster.template(self, 'groups-numbersItemRow', {
									number: val
								})));

							var numberDiv = template.find('[data-id="'+val.phoneNumber+'"]'),
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

						if(remainingQuantity === 0) {
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
							_.each(numbers, function(number, k) {
								number.phoneNumber = number.id;

								var rowTemplate = $(monster.template(self, 'groups-numbersItemRow', {
										number: number
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

								template.find('.list-unassigned-items .empty-row').hide();
								template.find('.list-unassigned-items').append(rowTemplate);
							});
						}
					}
				});
			});

			template.on('click', '.save-numbers', function() {
				var $this = $(this),
					parentRow = $this.parents('.grid-row'),
					callflowId = parentRow.data('callflow_id'),
					name = parentRow.data('name');
					dataNumbers = [];

				template.find('.item-row').each(function(k, row) {
					dataNumbers.push($(row).data('id'));
				});

				self.groupsUpdateNumbers(callflowId, dataNumbers, function(callflowData) {
					toastr.success(monster.template(self, '!' + toastrMessages.numbersUpdated, { name: name }));
					self.groupsRender({ groupId: callflowData.group_id });
				});
			});
		},

		groupsBindExtensions: function(template, data) {
			var self = this,
				toastrMessages = self.i18n.active().groups.toastrMessages,
				listExtension = [];

			template.on('click', '.save-extensions', function() {
				var extensionsToSave = [],
					parentRow = $(this).parents('.grid-row'),
					callflowId = parentRow.data('callflow_id'),
					name = parentRow.data('name');

				template.find('.list-assigned-items .item-row').each(function(k, row) {
					var row = $(row),
						number;

					number = (row.data('id') ? row.data('id') : row.find('.input-extension').val()) + '';

					extensionsToSave.push(number);
				});

				self.groupsUpdateExtensions(callflowId, extensionsToSave, function(callflowData) {
					toastr.success(monster.template(self, '!' + toastrMessages.numbersUpdated, { name: name }));
					self.groupsRender({ groupId: callflowData.group_id });
				});
			});

			template.on('click', '#add_extensions', function() {
				var renderNewRow = function(lastExtension) {
					var lastExtension = listExtension[listExtension.length - 1] + 1,
						dataTemplate = {
							recommendedExtension: lastExtension
						},
						newLineTemplate = $(monster.template(self, 'groups-newExtension', dataTemplate)),
						$listExtensions = template.find('.list-assigned-items');

					monster.ui.mask(newLineTemplate.find('.input-extension'), 'extension');

					listExtension.push(lastExtension);
					$listExtensions.find('.empty-row').hide();

					$listExtensions.append(newLineTemplate);
				};

				if(_.isEmpty(listExtension)) {
					self.groupsListExtensions(function(arrayExtension) {
						listExtension = arrayExtension;

						renderNewRow();
					});
				}
				else {
					renderNewRow();
				}
			});

			template.on('click', '.remove-extension', function() {
				var phoneRow = $(this).parents('.item-row'),
					emptyRow = phoneRow.siblings('.empty-row');

				if(phoneRow.siblings('.item-row').size() === 0) {
					emptyRow.show();
				}

				phoneRow.remove();
			});

			template.on('click', '.cancel-extension-link', function() {
				var extension = parseInt($(this).siblings('input').val()),
					index = listExtension.indexOf(extension);

				if(index > -1) {
					listExtension.splice(index, 1);
				}

				$(this).parents('.item-row').remove();
			});
		},

		groupsBindMembers: function(template, data) {
			var self = this;

			template.find('.save-groups').on('click', function() {
				var groupId = data.id;

				monster.pub('common.ringingDurationControl.getEndpoints', { 
					container: template,
					callback: function(endpoints) {
						_.each(endpoints, function(endpoint) {
							delete endpoint.name;
							endpoint.endpoint_type = 'user';
						});

						self.groupsUpdateBaseRingGroup(groupId, endpoints, function(data) {
							self.groupsRender({ groupId: groupId });
						});
					}
				});
			});

			template.on('click', '.add-user-link', function() {
				var usersInUse = $.map(template.find('.grid-time-row[data-id]'), function(val) {
						return $(val).data('id');
					}),
					remainingUsers = _.filter(data.extra.remainingUsers, function(val) {
						return usersInUse.indexOf(val.id) === -1;
					});

				monster.pub('common.monsterListing.render', {
					dataList: remainingUsers,
					dataType: 'users',
					okCallback: function(users) {
						_.each(users, function(user) {
							var newEndpoint = {
									id: user.id,
									timeout: 20,
									delay: 0,
									endpoint_type: 'user',
									name: user.name
								};

							monster.pub('common.ringingDurationControl.addEndpoint', {
								container: template.find('.members-container'),
								endpoint: newEndpoint,
								hasRemoveColumn: true
							});
						});
					}
				});
			});
		},

		groupsGetCreationData: function(callback) {
			var self = this;

			self.groupsListUsers(function(dataUsers) {
				var dataTemplate = {
					extra: {
						listUsers: dataUsers
					}
				};

				callback && callback(dataTemplate);
			});
		},

		groupsListUsers: function(callback) {
			var self = this;

			self.callApi({
				resource: 'user.list',
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

		groupsGetFeaturesData: function(groupId, callback) {
			var self = this;

			monster.parallel({
					group: function(callback) {
						self.groupsGetGroup(groupId, function(data) {
							callback(null, data);
						});
					},
					users: function(callback) {
						self.groupsListUsers(function(data) {
							callback(null, data);
						});
					},
					callflow: function(callback) {
						self.groupsGetRingGroup(groupId, function(data) {
							callback(null, data);
						});
					},
					baseCallflow: function(callback) {
						self.groupsGetBaseRingGroup(groupId, function(data) {
							callback(null, data);
						});
					},
					voicemails: function(callback) {
						self.groupsListVMBoxes(function(data) {
							callback(null, data);
						});
					},
					mainMenu: function(callback) {
						self.callApi({
							resource: 'callflow.list',
							data: {
								accountId: self.accountId,
								filters: { 'filter_type':'main' }
							},
							success: function(data) {
								callback(null, data.data && data.data.length > 0 ? _.find(data.data, function(callflow) { return callflow.numbers[0] === "MainOpenHoursMenu" }) : null);
							}
						});
					},
					userCallflows: function(callback) {
						self.callApi({
							resource: 'callflow.list',
							data: {
								accountId: self.accountId,
								filters: { 
									'has_key':'owner_id',
									'filter_type':'mainUserCallflow'
								}
							},
							success: function(data) {
								callback(null, data.data);
							}
						});
					}
				},
				function(err, results) {
					results.group.extra = self.groupsGetGroupFeatures(results.group);
					results.userCallflows = _.filter(results.userCallflows, function(userCallflow) {
						var user = _.find(results.users, function(user) { return userCallflow.owner_id === user.id });
						if(user) {
							userCallflow.userName = user.first_name + ' ' + user.last_name;
							return true;
						}
						return false;
					});
					callback && callback(results);
				}
			);
		},

		groupsGetNameData: function(groupId, callback) {
			var self = this;

			self.groupsGetGroup(groupId, function(data) {
				callback && callback(data);
			});
		},

		groupsFormatNumbersData: function(data, callback) {
			var self = this,
				response = {
					emptyExtensions: true,
					extensions: [],

					emptyAssigned: true,
					assignedNumbers: {},
					countSpare: 0,
					unassignedNumbers: {}
				};

			_.each(data.numbers.numbers, function(number, id) {
				/* TODO: Once locality is enabled, we need to remove it */
				number.localityEnabled = 'locality' in number ? true : false;

				if(!number.hasOwnProperty('used_by') || number.used_by === '') {
					response.unassignedNumbers[id] = number;
					response.countSpare++;
				}
			});

			if('groupCallflow' in data.callflow && 'numbers' in data.callflow.groupCallflow) {
				_.each(data.callflow.groupCallflow.numbers, function(number) {
					if(!(number in data.numbers.numbers)) {
						response.extensions.push(number);
					}
					else {
						data.numbers.numbers[number].isLocal = data.numbers.numbers[number].features.indexOf('local') > -1;
						response.assignedNumbers[number] = data.numbers.numbers[number];
					}
				});
			}
			response.emptyExtensions = _.isEmpty(response.extensions);
			response.emptyAssigned = _.isEmpty(response.assignedNumbers);
			response.emptySpare = _.isEmpty(response.unassignedNumbers);

			callback && callback(response);
		},

		groupsGetNumbersData: function(groupId, callback) {
			var self = this;

			monster.parallel({
					callflow: function(callbackParallel) {
						var response = {};

						self.callApi({
							resource: 'callflow.list',
							data: {
								accountId: self.accountId,
								filters: { 
									'filter_group_id': groupId,
									'filter_type': 'userGroup'
								}
							},
							success: function(data) {
								if(data.data.length > 0) {
									self.groupsGetCallflow(data.data[0].id, function(callflow) {
										response.groupCallflow = callflow;
										callbackParallel && callbackParallel(null, response);
									});
								} else {
									callbackParallel && callbackParallel(null, null);
								}
							}
						});
					},
					numbers: function(callbackParallel) {
						self.callApi({
							resource: 'numbers.list',
							data: {
								accountId: self.accountId,
								filters: {
									paginate: 'false'
								}
							},
							success: function(numbers) {
								callbackParallel && callbackParallel(null, numbers.data);
							}
						});
					}
				},
				function(err, results) {
					callback && callback(results);
				}
			);
		},

		groupsGetMembersData: function(groupId, globalCallback) {
			var self = this;

			monster.parallel({
					users: function(callback) {
						self.groupsListUsers(function(data) {
							callback(null, data);
						});
					},
					group: function(callback) {
						self.groupsGetGroup(groupId, function(data) {
							callback(null, data);
						});
					},
					baseCallflow: function(callback) {
						self.groupsGetBaseRingGroup(groupId, function(data) {
							callback(null, data);
						});
					}
				},
				function(err, results) {
					globalCallback && globalCallback(results);
				}
			);

		},

		groupsFormatMembersData: function(data) {
			var self = this,
				mapUsers = {},
				flow = data.baseCallflow.flow;

			_.each(data.users, function(user) {
				mapUsers[user.id] = user;
			});

			var endpoints = flow.data.endpoints;

			_.each(endpoints, function(endpoint) {
				endpoint.delay = parseInt(endpoint.delay);
				endpoint.timeout = parseInt(endpoint.timeout);

				if(endpoint.id in mapUsers) {
					endpoint.name = mapUsers[endpoint.id].first_name + ' ' + mapUsers[endpoint.id].last_name;
				} else {
					endpoint.name = self.i18n.active().groups.userDeleted;
					endpoint.deleted = true;
				}
			});

			data.group.extra = {
				ringGroup: endpoints,
				remainingUsers: mapUsers
			};

			return data.group;
		},

		groupsUpdateNumbers: function(callflowId, newNumbers, callback) {
			var self = this;

			self.groupsGetCallflow(callflowId, function(callflow) {
				_.each(callflow.numbers, function(number) {
					if(number.length < 7) {
						newNumbers.push(number);
					}
				});

				callflow.numbers = newNumbers;

				self.groupsUpdateCallflow(callflow, function(callflow) {
					callback && callback(callflow);
				});
			});
		},

		groupsUpdateExtensions: function(callflowId, newNumbers, callback) {
			var self = this;

			self.groupsGetCallflow(callflowId, function(callflow) {
				_.each(callflow.numbers, function(number) {
					if(number.length > 6) {
						newNumbers.push(number);
					}
				});

				callflow.numbers = newNumbers;

				self.groupsUpdateCallflow(callflow, function(callflow) {
					callback && callback(callflow);
				});
			});
		},

		groupsListExtensions: function(callback) {
			var self = this,
				extensionList = [];

			self.groupsListCallflows(function(callflowList) {
				_.each(callflowList, function(callflow) {
					_.each(callflow.numbers, function(number) {
						if(number.length < 7) {
							var extension = parseInt(number);

							if(extension > 1) {
								extensionList.push(extension);
							}
						}
					});
				});

				extensionList.sort(function(a, b) {
					var parsedA = parseInt(a),
						parsedB = parseInt(b),
						result = -1;

					if(parsedA > 0 && parsedB > 0) {
						result = parsedA > parsedB;
					}

					return result;
				});

				callback && callback(extensionList);
			});
		},

		groupsCheckWalkthrough: function() {
			var self = this;

			self.groupsHasWalkthrough(function() {
				self.groupsShowWalkthrough(function() {
					self.groupsUpdateWalkthroughFlagUser();
				});
			});
		},

		groupsHasWalkthrough: function(callback) {
			var self = this,
				flag = self.uiFlags.user.get('showGroupsWalkthrough');

			if(flag !== false) {
				callback && callback();
			}
		},

		groupsUpdateWalkthroughFlagUser: function(callback) {
			var self = this,
				userToSave = self.uiFlags.user.set('showGroupsWalkthrough', false);

			self.groupsUpdateOriginalUser(userToSave, function(user) {
				callback && callback(user);
			});
		},

		groupsShowWalkthrough: function(callback) {
			var self = this,
				mainTemplate = $('#voip_container'),
				rowFirstGroup = mainTemplate.find('.grid-row:not(.title):first'),
				steps =  [
					{
						element: mainTemplate.find('.add-group')[0],
						intro: self.i18n.active().groups.walkthrough.steps['1'],
						position: 'right'
					},
					{
						element: rowFirstGroup.find('.walkthrough-group')[0],
						intro: self.i18n.active().groups.walkthrough.steps['2'],
						position: 'right'
					},
					{
						element: rowFirstGroup.find('.phone-number')[0],
						intro: self.i18n.active().groups.walkthrough.steps['3'],
						position: 'bottom'
					},
					{
						element: rowFirstGroup.find('.features')[0],
						intro: self.i18n.active().groups.walkthrough.steps['4'],
						position: 'left'
					}
				];

			monster.ui.stepByStep(steps, function() {
				callback && callback();
			});
		},

		groupsListCallflows: function(callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: 'false'
					}
				},
				success: function(callflows) {
					callback && callback(callflows.data);
				}
			});
		},

		groupsListMedias: function(callback) {
			var self = this;

			self.callApi({
				resource: 'media.list',
				data: {
					accountId: self.accountId,
					filters: { 
						'paginate': 'false',
						'key_missing':'type' 
					}
				},
				success: function(medias) {
					callback && callback(medias.data);
				}
			});
		},

		groupsListVMBoxes: function(callback) {
			var self = this;

			self.callApi({
				resource: 'voicemail.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: 'false'
					}
				},
				success: function(medias) {
					callback && callback(medias.data);
				}
			});
		},

		groupsCreate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'group.create',
				data: {
					accountId: self.accountId,
					data: data.group
				},
				success: function(dataGroup) {
					data.callflow.group_id = dataGroup.data.id;
					data.baseCallflow.group_id = dataGroup.data.id;

					self.callApi({
						resource: 'callflow.create',
						data: {
							accountId: self.accountId,
							data: data.baseCallflow
						},
						success: function(dataBaseCallflow) {
							data.callflow.flow.data.id = dataBaseCallflow.data.id;
							self.callApi({
								resource: 'callflow.create',
								data: {
									accountId: self.accountId,
									data: data.callflow
								},
								success: function(data) {
									callback && callback(dataGroup.data);
								},
								error: function() {
									self.callApi({
										resource: 'group.delete',
										data: {
											accountId: self.accountId,
											groupId: dataGroup.data.id
										}
									});
									self.callApi({
										resource: 'callflow.delete',
										data: {
											accountId: self.accountId,
											callflowId: dataBaseCallflow.data.id
										}
									});
								}
							});
						},
						error: function() {
							self.callApi({
								resource: 'group.delete',
								data: {
									accountId: self.accountId,
									groupId: dataGroup.data.id
								}
							});
						}
					});
				}
			});
		},

		groupsGetRingGroup: function(groupId, callback, callbackError) {
			var self = this;

			self.callApi({
				resource: 'callflow.list',
				data: {
					accountId: self.accountId,
					filters: { 
						'filter_group_id': groupId,
						'filter_type': 'userGroup'
					}
				},
				success: function(data) {
					if(data.data.length > 0) {
						self.groupsGetCallflow(data.data[0].id, function(callflow) {
							callback && callback(callflow);
						});
					}
					else {
						callbackError && callbackError(data);

						toastr.error(self.i18n.active().groups.ringGroupMissing);
					}
				},
				error: function(data) {
					callbackError && callbackError(data);
				}
			});
		},

		groupsGetBaseRingGroup: function(groupId, callback, callbackError) {
			var self = this;

			self.callApi({
				resource: 'callflow.list',
				data: {
					accountId: self.accountId,
					filters: { 
						'filter_group_id': groupId,
						'filter_type': 'baseGroup'
					}
				},
				success: function(data) {
					if(data.data.length > 0) {
						self.groupsGetCallflow(data.data[0].id, function(callflow) {
							callback && callback(callflow);
						});
					}
					else {
						callbackError && callbackError(data);

						toastr.error(self.i18n.active().groups.ringGroupMissing);
					}
				},
				error: function(data) {
					callbackError && callbackError(data);
				}
			});
		},

		groupsComputeTimeout: function(endpoints) {
			var globalTimeout = 0;

			_.each(endpoints, function(endpoint) {
				var delay = parseInt(endpoint.delay),
					timeout = parseInt(endpoint.timeout),
					total = delay + timeout;

				if(total > globalTimeout) {
					globalTimeout = total;
				}
			});

			return globalTimeout;
		},

		groupsUpdateBaseRingGroup: function(groupId, endpoints, callback) {
			var self = this;

			monster.parallel({
					group: function(callback) {
						self.groupsGetGroup(groupId, function(data) {
							var areDifferent = false;

							_.each(endpoints, function(endpoint) {
								if(endpoint.id in data.endpoints) {
									delete data.endpoints[endpoint.id];
								}
								else {
									areDifferent = true;
									return false;
								}
							});

							if(!_.isEmpty(data.endpoints)) {
								areDifferent = true;
							}

							if(areDifferent) {
								data.endpoints = {};

								_.each(endpoints, function(v) {
									data.endpoints[v.id] = { type: 'user' };
								});

								self.groupsUpdate(data, function(data) {
									callback && callback(null, data);
								});
							}
							else {
								callback && callback(null, data);
							}
						});
					},
					callflow: function(callback) {
						self.groupsGetBaseRingGroup(groupId, function(ringGroup) {
							ringGroup.flow.data.endpoints = endpoints;
							ringGroup.flow.data.timeout = self.groupsComputeTimeout(endpoints);

							self.groupsUpdateCallflow(ringGroup, function(data) {
								callback && callback(null, data);
							});
						});
					},
				},
				function(error, results) {
					callback && callback(results);
				}
			);
		},

		groupsUpdate: function(group, callback) {
			var self = this;

			delete group.extra;

			self.callApi({
				resource: 'group.update',
				data: {
					accountId: self.accountId,
					groupId: group.id,
					data: group
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		groupsUpdateCallflow: function(callflow, callback) {
			var self = this;

			delete callflow.metadata;

			self.callApi({
				resource: 'callflow.update',
				data: {
					accountId: self.accountId,
					callflowId: callflow.id,
					data: callflow
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		groupsGetGroup: function(groupId, callback) {
			var self = this;

			self.callApi({
				resource: 'group.get',
				data: {
					groupId: groupId,
					accountId: self.accountId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		groupsDelete: function(groupId, callback) {
			var self = this;

			monster.parallel({
					group: function(callback) {
						self.callApi({
							resource: 'group.delete',
							data: {
								accountId: self.accountId,
								groupId: groupId
							},
							success: function(data) {
								callback && callback(null, data.data);
							}
						});
					},
					callflow: function(callback) {
						self.groupsGetRingGroup(groupId, function(data) {
							self.callApi({
								resource: 'callflow.delete',
								data: {
									accountId: self.accountId,
									callflowId: data.id
								},
								success: function(data) {
									callback && callback(null, data);
								}
							});
						},
						function(data) {
							callback && callback(null, data);
						});
					},
					baseCallflow: function(callback) {
						self.groupsGetBaseRingGroup(groupId, function(data) {
							self.callApi({
								resource: 'callflow.delete',
								data: {
									accountId: self.accountId,
									callflowId: data.id
								},
								success: function(data) {
									callback && callback(null, data);
								}
							});
						},
						function(data) {
							callback && callback(null, data);
						});
					}
				},
				function(err, results) {
					callback && callback(results);
				}
			);
		},

		groupsGetCallflow: function(callflowId, callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.get',
				data: {
					accountId: self.accountId,
					callflowId: callflowId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		groupsGetData: function(callback) {
			var self = this;

			monster.parallel({
					groups: function(callback) {
						self.callApi({
							resource: 'group.list',
							data: {
								accountId: self.accountId,
								filters: {
									paginate: 'false'
								}
							},
							success: function(dataGroups) {
								callback(null, dataGroups.data);
							}
						});
					},
					callflows: function(callback) {
						self.callApi({
							resource: 'callflow.list',
							data: {
								accountId: self.accountId,
								filters: {'has_key':'group_id'}
							},
							success: function(dataCallflows) {
								callback(null, dataCallflows.data);
							}
						});
					}
				},
				function(err, results) {
					callback && callback(results);
				}
			);
		},

		groupsRemoveOverlay: function() {
			$('body').find('#groups_container_overlay').remove();
		},

		groupsUpdateOriginalUser: function(userToUpdate, callback) {
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
