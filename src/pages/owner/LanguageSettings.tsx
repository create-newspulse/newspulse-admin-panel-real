import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function LanguageSettings() {
	const { t, i18n } = useTranslation();
	const [lang, setLang] = useState(i18n.language || 'en');

	const changeLanguage = (lng: string) => {
		i18n.changeLanguage(lng);
		setLang(lng);
	};

	return (
		<div className="max-w-xl mx-auto bg-white dark:bg-slate-800 p-6 rounded-lg shadow border border-slate-200 dark:border-slate-700">
			<h1 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">{t('languageSettings') || 'Language Settings'}</h1>

			<label className="block text-sm text-slate-600 dark:text-slate-300 mb-2">{t('chooseLanguage') || 'Choose language'}</label>
			<select
				value={lang}
				onChange={(e) => changeLanguage(e.target.value)}
				className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
			>
				<option value="en">English</option>
				<option value="hi">हिंदी</option>
				<option value="gu">ગુજરાતી</option>
			</select>

			<p className="text-xs text-slate-500 dark:text-slate-400 mt-4">
				{t('languageSettingsNote') || 'This setting affects UI labels and messages.'}
			</p>
		</div>
	);
}
