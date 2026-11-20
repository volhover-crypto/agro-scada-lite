// Все тексты интерфейса — на русском (01_README_AGENT §4.7).
// Словарь пополняется по задачам; ключи — по смыслу, не по экранам.
export const ru = {
  appTitle: 'Agro-SCADA Lite',
  t01ScaffoldNote: 'Каркас приложения (задача T01). Экраны появятся в следующих задачах.',

  // Витрина токенов /dev/tokens (T02)
  devTokens: {
    title: 'Витрина токенов',
    subtitle:
      'Дизайн-токены из 06_DESIGN_TOKENS. Значения [approx] — приблизительные, до передачи бренд-материалов владельцем',
    brand: 'Бренд',
    brandOlive: 'Олива — логотип, акцентные кнопки, активный пункт меню',
    brandOliveDark: 'Олива тёмная — hover, заголовки разделов',
    brandBlue: 'Синий — связь, данные, линии графиков',
    logoStub: 'Логотип-заглушка (заменит владелец)',
    surfaces: 'Фоны, текст, рамки',
    bgPage: 'Фон страницы',
    bgSurface: 'Карточки, панели',
    bgSunken: 'Поля ввода, подложки',
    textPrimary: 'Основной текст',
    textSecondary: 'Подписи, время',
    borderAndShadow: 'Рамка и тень карточки',
    dataStatuses: 'Статусы данных (единые во всём приложении)',
    statusGood: 'good — обычное значение',
    statusStale: 'stale — обновлено 12 мин назад',
    statusOffline: 'offline — нет связи с датчиком',
    statusOutOfRange: 'out_of_range — вне диапазона',
    statusSensorError: 'sensor_error — ошибка датчика',
    statusForecast: 'forecast — прогноз на 21.11, 12:00',
    statusSim: 'ТЕСТ',
    alarmPriorities: 'Приоритеты тревог',
    alarmP1: 'P1 Авария',
    alarmP2: 'P2 Важно',
    alarmP3: 'P3 Предупреждение',
    alarmP4: 'P4 Информация',
    actuatorStates: 'Состояния исполнителей',
    actuatorOn: 'Включено',
    actuatorOff: 'Выключено',
    actuatorPending: 'Ожидание (пульсация 1,2 с)',
    actuatorUnknown: 'Неизвестно',
    actuatorFault: 'Авария',
    typography: 'Типографика',
    typographyNote: 'Заголовки 600, текст 400, крупные значения 28–40 (600), цифры tabular-nums',
    shape: 'Формы, отступы, касание',
    radiusCard: 'Карточка 14',
    radiusBtn: 'Кнопка 10',
    radiusCta: 'Круглая CTA',
    spacingScale: 'Шкала отступов 4 px: 4 · 8 · 12 · 16 · 24 · 32',
    touchNote: 'Касание: минимум 44×44, главные кнопки управления на телефоне ≥ 56 высотой',
  },
} as const

export type Dict = typeof ru
