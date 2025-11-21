import { MenuItem, Select, type SelectChangeEvent, FormControl } from '@mui/material';
import { useI18n, type Locale } from '../../lib/i18n';

const LanguageSelector = () => {
    const { locale, setLocale, strings } = useI18n();

    const handleChange = (event: SelectChangeEvent) => {
        setLocale(event.target.value as Locale);
    };

    const languageOptions = strings.settings?.languageOptions ?? {
        'en-US': 'English (English)',
        'ko-KR': '한국어 (한국어)',
        'ja-JP': '日本語 (日本語)',
    };

    const languages: { value: Locale; label: string }[] = [
        { value: 'en-US', label: languageOptions['en-US'] },
        { value: 'ko-KR', label: languageOptions['ko-KR'] },
        { value: 'ja-JP', label: languageOptions['ja-JP'] },
    ];

    return (
        <FormControl size="small" variant="outlined" data-testid="language-selector-wrapper">
            <Select
                value={locale}
                onChange={handleChange}
                displayEmpty
                inputProps={{ 'aria-label': 'Select language' }}
                sx={{
                    minWidth: 100,
                    bgcolor: 'background.paper',
                    '& .MuiSelect-select': {
                        py: 1,
                    }
                }}
            >
                {languages.map((lang) => (
                    <MenuItem key={lang.value} value={lang.value}>
                        {lang.label}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
};

export default LanguageSelector;
