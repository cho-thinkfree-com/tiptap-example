import { MenuItem, Select, type SelectChangeEvent, FormControl } from '@mui/material';
import { useI18n, type Locale } from '../../lib/i18n';

const LanguageSelector = () => {
    const { locale, setLocale } = useI18n();

    const handleChange = (event: SelectChangeEvent) => {
        setLocale(event.target.value as Locale);
    };

    const languages: { value: Locale; label: string }[] = [
        { value: 'en-US', label: 'English' },
        { value: 'ko-KR', label: '한국어' },
        { value: 'ja-JP', label: '日本語' },
    ];

    return (
        <FormControl size="small" variant="outlined">
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
