define(function(require){
	var $ = require('jquery'),
		_ = require('underscore'),
		monster = require('monster');

	var app = {
		name: 'voip',

		css: [ 'app' ],

		i18n: { 
			'en-US': { customCss: false },
			'fr-FR': { customCss: false },
			'ru-RU': { customCss: false }
		},

		requests: {
			'voip.users.getUsers': {
				url: 'accounts/{accountId}/users',
				verb: 'GET'
			},
			'voip.groups.listGroups': {
				url: 'accounts/{accountId}/groups',
				verb: 'GET'
			},
			'common.numbers.list': {
				url: 'accounts/{accountId}/phone_numbers',
				verb: 'GET'
			},
			'voip.devices.listDevices': {
				url: 'accounts/{accountId}/devices',
				verb: 'GET'
			},
		},

		subscribe: {
		},

		subModules: ['devices', 'groups', 'numbers', 'strategy', 'callLogs', 'users', 'myOffice', 'featureCodes'],

		load: function(callback){
			var self = this;

			self.initApp(function() {
				callback && callback(self);
			});
		},

		initApp: function(callback) {
			var self = this;

			monster.pub('auth.initApp', {
				app: self,
				callback: callback
			});
		},

		render: function(container){
			var self = this,
				parent = container || $('#monster-content'),
				template = $(monster.template(self, 'app'));

			/* On first Load, load my office */
			template.find('.category#my_office').addClass('active');
			monster.pub('voip.myOffice.render', { parent: template.find('.right-content') });

			self.bindEvents(template);

			parent
				.empty()
				.append(template);
		},

		formatData: function(data) {
			var self = this;
		},

		bindEvents: function(parent) {
			var self = this,
				container = parent.find('.right-content');

			parent.find('.category').on('click', function() {
				parent
					.find('.category')
					.removeClass('active');

				container.empty();

				$(this).toggleClass('active');
			});

			var args = {
				parent: container
			};

			parent.find('.category#my_office').on('click', function() {
				monster.pub('voip.myOffice.render', args);
			});

			parent.find('.category#users').on('click', function() {
				monster.pub('voip.users.render', args);
			});

			parent.find('.category#groups').on('click', function() {
				monster.pub('voip.groups.render', args);
			});

			parent.find('.category#numbers').on('click', function() {
				monster.pub('voip.numbers.render', container);
			});

			parent.find('.category#devices').on('click', function() {
				monster.pub('voip.devices.render', args);
			});

			parent.find('.category#strategy').on('click', function() {
				monster.pub('voip.strategy.render', args);
			});

			parent.find('.category#call_logs').on('click', function() {
				monster.pub('voip.callLogs.render', args);
			});

			parent.find('.category#feature_codes').on('click', function() {
				monster.pub('voip.featureCodes.render', args);
			});
		}
	};

	return app;
});
