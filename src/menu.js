import { state, recallSession } from '.';

export function renderMenu () {
	return ['div', {
		className: 'menu',
	},
		['button', {
			className: 'button',
			onclick: () => {
				window.localStorage.removeItem('impulse');
				recallSession();
			},
		}, 'Clear'],
	];
}
