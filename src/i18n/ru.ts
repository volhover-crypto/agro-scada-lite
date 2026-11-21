// Все тексты интерфейса — на русском (01_README_AGENT §4.7).
// Словарь пополняется по задачам; ключи — по смыслу, не по экранам.
export const ru = {
  appTitle: 'Agro-SCADA Lite',
  t01ScaffoldNote: 'Каркас приложения (задача T01). Экраны появятся в следующих задачах.',

  // Общие тексты
  common: {
    unknownError: 'Не удалось выполнить действие',
  },

  // Каркас приложения (T06)
  shell: {
    // навигация (05 §0)
    navOverview: 'Обзор',
    navObjects: 'Объекты',
    navAlarms: 'Тревоги',
    navCharts: 'Графики',
    navRules: 'Правила',
    navSchedules: 'Расписания',
    navAudit: 'Журнал',
    navSettings: 'Настройки',
    navControl: 'Управление',
    navMore: 'Ещё',
    // шапка
    objectSelectPlaceholder: 'Объект…',
    linkStatusOk: 'Связь: все модемы онлайн',
    linkStatusPartial: 'Связь: {online} из {total} модемов',
    linkStatusNone: 'Нет связи с объектом',
    bsStatusHint: 'Статус БС появится после обновления контракта (BR-FE-1)',
    alarmsCount: 'Активные тревоги: {n}',
    simBadge: 'ТЕСТ',
    simBadgeHint: 'Режим симулятора: данные тестовые',
    logout: 'Выйти',
    // баннеры
    alarmConfirm: 'Подтвердить',
    alarmOpen: 'Открыть',
    offlineBanner: 'Нет связи с сервером, данные на {time}',
    stubNote: 'Раздел будет реализован в задаче {task}',
    overviewNote: 'Обзор объектов — задача T09. Пока доступна витрина токенов: /dev/tokens',
  },

  // Экран входа (T05)
  login: {
    title: 'Вход',
    loginLabel: 'Логин',
    passwordLabel: 'Пароль',
    submit: 'Войти',
    submitting: 'Входим…',
    wrongCredentials: 'Неверный логин или пароль',
  },

  // Коды ошибок API: код → текст (02_ARCHITECTURE_FE §8).
  // NETWORK — клиентский код (нет сети), остальные — enum Error из контракта.
  apiErrors: {
    UNAUTHORIZED: 'Сессия истекла. Войдите снова',
    NOT_FOUND: 'Не найдено',
    VALIDATION: 'Проверьте правильность данных',
    MODE_MANUAL: 'Устройство в ручном режиме — автоматика не выполняется',
    DURATION_OVER_MAX: 'Длительность больше допустимой',
    DURATION_REQUIRED: 'Не указана длительность',
    NOT_APPROVED: 'Правило или расписание не утверждено',
    ALREADY_FINAL: 'Действие невозможно: команда уже завершена',
    RATE_LIMIT: 'Слишком много попыток, повторите через минуту',
    NETWORK: 'Нет связи с сервером',
  } as Record<string, string>,

  // Панель отладки мока (T04, только при VITE_USE_MOCK=true)
  mock: {
    fab: 'Мок',
    panelTitle: 'Мок-сервер',
    scenario: 'Сценарий',
    speed: 'Ускорение времени',
    loseAck: 'Терять ack (команды завершаются timeout)',
    rejectResult: 'Модем отклоняет команду (result_code=1)',
    reset: 'Сбросить данные',
  },

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
