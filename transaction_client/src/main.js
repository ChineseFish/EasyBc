import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import './registerServiceWorker'
import { Dialog, MessageBox, Card, Button, Select, Input, Notification, Menu, Submenu, MenuItemGroup, MenuItem } from 'element-ui';

Vue.use(Dialog);
Vue.use(MessageBox);
Vue.use(Card);
Vue.use(Button);
Vue.use(Select);
Vue.use(Input);
Vue.use(Notification);
Vue.use(Menu);
Vue.use(Submenu);
Vue.use(MenuItemGroup);
Vue.use(MenuItem);

Vue.config.productionTip = false

Vue.prototype.$notify = {
	success: opts => {
		Notification.success(opts);
	},

	error: opts => {
		Notification.error(opts);
	},

	warn: opts => {
		Notification.warning(opts);
	}
}

Vue.prototype.$alert = opts => {
	MessageBox(opts);
}

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')