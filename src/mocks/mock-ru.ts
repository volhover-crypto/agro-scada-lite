/*
 * Строки панели отладки мока (T04) — отдельным модулем, не в общей локали:
 * DebugPanel попадает в бандл только при VITE_USE_MOCK=true, и вместе с ним
 * эти строки не должны утечь в прод-сборку (09_INTEGRATION_CHECKLIST A1:
 * поиск по dist не находит панель отладки)
 */
export const mockRu = {
  fab: 'Мок',
  panelTitle: 'Мок-сервер',
  scenario: 'Сценарий',
  speed: 'Ускорение времени',
  loseAck: 'Терять ack (команды завершаются timeout)',
  rejectResult: 'Модем отклоняет команду (result_code=1)',
  modeFail: 'Ломать смену режима (423)',
  reset: 'Сбросить данные',
}
