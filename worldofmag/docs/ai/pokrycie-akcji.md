# Pokrycie akcji użytkownika przez asystenta AI

> Plik generowany przez `scripts/check-ai-coverage.js --report`. Nie edytuj ręcznie.

Mutacje (zapis): **113 ai / 117 pending / 113 excluded**. Odczyty (podgląd danych): **41 ai / 44 pending / 60 excluded**.

Legenda: `ai` = asystent to potrafi · `pending` = luka do domknięcia · `excluded` = nie dla AI (admin/ustawienia/wewnętrzne/interaktywne).

## access — 0/11 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `addUserRole` | zapis | ⛔ excluded | admin |
| `createPermission` | zapis | ⛔ excluded | admin |
| `deletePermission` | zapis | ⛔ excluded | admin |
| `getAuditLog` | odczyt | ⛔ excluded | admin |
| `getAvailableRoles` | odczyt | ⛔ excluded | admin |
| `getPermissions` | odczyt | ⛔ excluded | admin |
| `getRolePermissions` | odczyt | ⛔ excluded | admin |
| `getUsers` | odczyt | ⛔ excluded | admin |
| `removeUserRole` | zapis | ⛔ excluded | admin |
| `toggleRolePermission` | zapis | ⛔ excluded | admin |
| `updatePermission` | zapis | ⛔ excluded | admin |

## activity — 0/2 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `getRecentActivity` | odczyt | ⛔ excluded | settings |
| `trackActivity` | zapis | ⛔ excluded | internal |

## adminCategories — 0/4 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `createSystemCategory` | zapis | ⛔ excluded | admin |
| `deleteSystemCategory` | zapis | ⛔ excluded | admin |
| `getSystemCategories` | odczyt | ⛔ excluded | admin |
| `updateSystemCategory` | zapis | ⛔ excluded | admin |

## aiConversations — 0/6 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `appendAiMessage` | zapis | ⛔ excluded | internal |
| `createAiConversation` | zapis | ⛔ excluded | internal |
| `deleteAiConversation` | zapis | ⛔ excluded | internal |
| `getAiConversation` | odczyt | ⛔ excluded | internal |
| `listAiConversations` | odczyt | ⛔ excluded | internal |
| `renameAiConversation` | zapis | ⛔ excluded | internal |

## calendar — 1/3 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `getCalendarEvents` | odczyt | ✅ ai |  |
| `getMyIcalFeedUrl` | odczyt | ⛔ excluded | settings |
| `regenerateIcalFeed` | zapis | ⛔ excluded | settings |

## categories — 0/6 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `createCategory` | zapis | 🕓 pending |  |
| `deleteCategory` | zapis | 🕓 pending |  |
| `getCategories` | odczyt | 🕓 pending |  |
| `getCategoryEmojiMap` | odczyt | 🕓 pending |  |
| `getCategoryNames` | odczyt | 🕓 pending |  |
| `updateCategory` | zapis | 🕓 pending |  |

## categoryIcons — 0/12 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `assignIconToCategory` | zapis | ⛔ excluded | admin |
| `deactivateCategoryIcon` | zapis | ⛔ excluded | admin |
| `deleteCategoryIconVariant` | zapis | ⛔ excluded | admin |
| `getActiveCategoryIconMap` | odczyt | ⛔ excluded | admin |
| `getAllUserIconVariants` | odczyt | ⛔ excluded | admin |
| `getAllUserIconVariantsFlat` | odczyt | ⛔ excluded | admin |
| `getCategoryIconVariants` | odczyt | ⛔ excluded | admin |
| `orphanCategoryIcons` | zapis | ⛔ excluded | admin |
| `saveAndActivateCategoryIcon` | zapis | ⛔ excluded | admin |
| `saveToLibrary` | zapis | ⛔ excluded | admin |
| `setActiveCategoryIcon` | zapis | ⛔ excluded | admin |
| `upsertCategoryEmojiOverride` | zapis | ⛔ excluded | admin |

## config — 0/3 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `getConfigMasked` | odczyt | ⛔ excluded | settings |
| `getConfigValue` | odczyt | ⛔ excluded | settings |
| `setConfigValue` | zapis | ⛔ excluded | admin |

## contacts — 4/4 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `createContact` | zapis | ✅ ai | → create_contact |
| `deleteContact` | zapis | ✅ ai | → delete_contact |
| `getContacts` | odczyt | ✅ ai |  |
| `updateContact` | zapis | ✅ ai | → update_contact |

## cookbooks — 0/5 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `createCookbook` | zapis | 🕓 pending |  |
| `deleteCookbook` | zapis | 🕓 pending |  |
| `getCookbook` | odczyt | 🕓 pending |  |
| `getCookbooks` | odczyt | 🕓 pending |  |
| `updateCookbook` | zapis | 🕓 pending |  |

## dashboardPrefs — 0/2 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `getDashboardPrefs` | odczyt | ⛔ excluded | settings |
| `setDashboardPrefs` | zapis | ⛔ excluded | settings |

## drive — 0/2 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `disconnectDrive` | zapis | ⛔ excluded | settings |
| `getDriveStatus` | odczyt | ⛔ excluded | settings |

## flota — 7/11 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `addFuelLog` | zapis | ✅ ai |  |
| `addServiceRecord` | zapis | ✅ ai |  |
| `addVehicleAttachment` | zapis | ⛔ excluded | interactive |
| `createVehicle` | zapis | ✅ ai |  |
| `deleteFuelLog` | zapis | 🕓 pending |  |
| `deleteServiceRecord` | zapis | 🕓 pending |  |
| `deleteVehicle` | zapis | ✅ ai |  |
| `deleteVehicleAttachment` | zapis | ⛔ excluded | interactive |
| `getVehicle` | odczyt | ✅ ai |  |
| `getVehicles` | odczyt | ✅ ai |  |
| `updateVehicle` | zapis | ✅ ai |  |

## habits — 6/8 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `createHabit` | zapis | ✅ ai |  |
| `createTaskFromHabit` | zapis | 🕓 pending |  |
| `deleteHabit` | zapis | ✅ ai |  |
| `getHabits` | odczyt | ✅ ai |  |
| `reorderHabits` | zapis | ⛔ excluded | interactive |
| `setHabitArchived` | zapis | ✅ ai |  |
| `toggleHabitDay` | zapis | ✅ ai |  |
| `updateHabit` | zapis | ✅ ai |  |

## health — 5/11 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `addHealthAttachment` | zapis | ⛔ excluded | interactive |
| `createHealthEvent` | zapis | ✅ ai |  |
| `deleteHealthAttachment` | zapis | ⛔ excluded | interactive |
| `deleteHealthEvent` | zapis | ✅ ai |  |
| `getHealthAttachments` | odczyt | ⛔ excluded | interactive |
| `getHealthEvents` | odczyt | ✅ ai |  |
| `getHealthSettings` | odczyt | ⛔ excluded | settings |
| `getTestTrends` | odczyt | 🕓 pending |  |
| `setHealthAiOptIn` | zapis | ⛔ excluded | admin |
| `setHealthStatus` | zapis | ✅ ai |  |
| `updateHealthEvent` | zapis | ✅ ai |  |

## invitations — 0/5 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `acceptInvitation` | zapis | ⛔ excluded | teams |
| `getPendingInvitations` | odczyt | ⛔ excluded | teams |
| `getPendingInvitationsCount` | odczyt | ⛔ excluded | teams |
| `inviteUser` | zapis | ⛔ excluded | teams |
| `rejectInvitation` | zapis | ⛔ excluded | teams |

## items — 7/10 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `addItem` | zapis | ✅ ai |  |
| `addItemStructured` | zapis | ⛔ excluded | interactive |
| `clearDoneItems` | zapis | ✅ ai |  |
| `deleteItem` | zapis | ✅ ai |  |
| `getSuggestionsForPrefix` | odczyt | ⛔ excluded | settings |
| `markAllInCart` | zapis | ✅ ai |  |
| `moveItem` | zapis | ✅ ai | → move_item |
| `reorderItems` | zapis | ⛔ excluded | interactive |
| `updateItem` | zapis | ✅ ai |  |
| `updateItemStatus` | zapis | ✅ ai |  |

## jobs — 0/4 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `cancelJobAction` | zapis | ⛔ excluded | admin |
| `cleanupJobsAction` | zapis | ⛔ excluded | admin |
| `getJobsOverview` | odczyt | ⛔ excluded | admin |
| `retryJobAction` | zapis | ⛔ excluded | admin |

## languageDecks — 7/12 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `addWord` | zapis | ✅ ai |  |
| `bulkAddWords` | zapis | 🕓 pending |  |
| `createDeck` | zapis | ✅ ai |  |
| `deleteDeck` | zapis | ✅ ai |  |
| `deleteWord` | zapis | ✅ ai |  |
| `getDeck` | odczyt | 🕓 pending |  |
| `getDecks` | odczyt | ✅ ai |  |
| `getDueCards` | odczyt | 🕓 pending |  |
| `getStudyStreak` | odczyt | 🕓 pending |  |
| `submitReview` | zapis | ⛔ excluded | interactive |
| `updateDeck` | zapis | ✅ ai |  |
| `updateWord` | zapis | ✅ ai |  |

## legal — 0/4 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `acceptAllCurrentConsents` | zapis | ⛔ excluded | account |
| `acceptConsent` | zapis | ⛔ excluded | account |
| `getMyConsents` | odczyt | ⛔ excluded | account |
| `getOutstandingConsents` | odczyt | ⛔ excluded | account |

## lists — 9/10 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `archiveList` | zapis | ✅ ai |  |
| `completeShopping` | zapis | ✅ ai | → complete_shopping |
| `createList` | zapis | ✅ ai |  |
| `deleteList` | zapis | ✅ ai |  |
| `getActiveListsForOffline` | odczyt | ⛔ excluded | settings |
| `getArchivedLists` | odczyt | ✅ ai |  |
| `getLists` | odczyt | ✅ ai |  |
| `getListSummaries` | odczyt | ✅ ai |  |
| `renameList` | zapis | ✅ ai |  |
| `unarchiveList` | zapis | ✅ ai | → unarchive_list |

## llmConfig — 0/10 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `applyAnthropicProfile` | zapis | ⛔ excluded | admin |
| `createProvider` | zapis | ⛔ excluded | admin |
| `deleteProvider` | zapis | ⛔ excluded | admin |
| `getAiCostBreakdown` | odczyt | ⛔ excluded | admin |
| `getAssignments` | odczyt | ⛔ excluded | admin |
| `getCostAlertThreshold` | odczyt | ⛔ excluded | admin |
| `getLlmProviders` | odczyt | ⛔ excluded | admin |
| `setAssignment` | zapis | ⛔ excluded | admin |
| `setCostAlertThreshold` | zapis | ⛔ excluded | admin |
| `updateProvider` | zapis | ⛔ excluded | admin |

## mealPlans — 5/11 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `bulkSetMealPlan` | zapis | 🕓 pending |  |
| `deleteMealPlanEntry` | zapis | ✅ ai |  |
| `generateShoppingListFromPlan` | zapis | ✅ ai | → generate_shopping_from_plan |
| `getMealPlan` | odczyt | ✅ ai |  |
| `getMealPlanCost` | odczyt | 🕓 pending |  |
| `getTodaysMeals` | odczyt | 🕓 pending |  |
| `markMealCooked` | zapis | ✅ ai |  |
| `markMealSkipped` | zapis | 🕓 pending |  |
| `moveMealPlanEntry` | zapis | 🕓 pending |  |
| `setMealPlanEntry` | zapis | ✅ ai |  |
| `updateMealPlanEntry` | zapis | 🕓 pending |  |

## medications — 7/7 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `createMedicationSchedule` | zapis | ✅ ai |  |
| `deleteMedicationSchedule` | zapis | ✅ ai |  |
| `getMedicationDay` | odczyt | ✅ ai |  |
| `getMedicationSchedules` | odczyt | ✅ ai |  |
| `logDose` | zapis | ✅ ai |  |
| `unlogDose` | zapis | ✅ ai | → unlog_dose |
| `updateMedicationSchedule` | zapis | ✅ ai | → update_medication |

## menuPrefs — 0/2 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `getMenuPrefs` | odczyt | ⛔ excluded | settings |
| `updateMenuPrefs` | zapis | ⛔ excluded | settings |

## metrics — 0/1 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `getUnitEconomics` | odczyt | ⛔ excluded | settings |

## news — 6/18 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `acknowledgeItem` | zapis | 🕓 pending |  |
| `createSource` | zapis | 🕓 pending |  |
| `createTopic` | zapis | ✅ ai |  |
| `deleteSource` | zapis | 🕓 pending |  |
| `deleteTopic` | zapis | ✅ ai |  |
| `dismissItem` | zapis | 🕓 pending |  |
| `getHotTopics` | odczyt | ✅ ai | → list_hot_topics |
| `getKnowledgeHistory` | odczyt | 🕓 pending |  |
| `getNewsPref` | odczyt | 🕓 pending |  |
| `getSources` | odczyt | 🕓 pending |  |
| `getTopics` | odczyt | ✅ ai |  |
| `getTopicView` | odczyt | 🕓 pending |  |
| `refreshTopic` | zapis | ✅ ai |  |
| `resummarizeItem` | zapis | 🕓 pending |  |
| `setActiveSource` | zapis | ⛔ excluded | admin |
| `setDefaultSummaryLength` | zapis | ⛔ excluded | admin |
| `updateSource` | zapis | 🕓 pending |  |
| `updateTopic` | zapis | ✅ ai |  |

## noteGroups — 0/4 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `createNoteGroup` | zapis | 🕓 pending |  |
| `deleteNoteGroup` | zapis | 🕓 pending |  |
| `getNoteGroups` | odczyt | 🕓 pending |  |
| `updateNoteGroup` | zapis | 🕓 pending |  |

## notes — 6/13 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `addNoteAttachment` | zapis | ⛔ excluded | interactive |
| `addTagToNote` | zapis | 🕓 pending |  |
| `createNote` | zapis | ✅ ai |  |
| `deleteNote` | zapis | ✅ ai |  |
| `deleteNoteAttachment` | zapis | ⛔ excluded | interactive |
| `getNoteAttachments` | odczyt | ⛔ excluded | interactive |
| `getNoteRevisions` | odczyt | ⛔ excluded | interactive |
| `getNotes` | odczyt | ✅ ai |  |
| `removeTagFromNote` | zapis | 🕓 pending |  |
| `restoreNoteRevision` | zapis | ⛔ excluded | interactive |
| `setNoteTags` | zapis | ✅ ai | → set_note_tags |
| `toggleNotePin` | zapis | ✅ ai |  |
| `updateNote` | zapis | ✅ ai |  |

## notifications — 1/6 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `getNotifications` | odczyt | ⛔ excluded | settings |
| `getUnreadCount` | odczyt | ⛔ excluded | settings |
| `markAllNotificationsRead` | zapis | ⛔ excluded | internal |
| `markNotificationRead` | zapis | ⛔ excluded | internal |
| `notifyUser` | zapis | ✅ ai |  |
| `syncReminders` | zapis | ⛔ excluded | internal |

## pantry — 5/11 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `addPantryItem` | zapis | ✅ ai |  |
| `autoReplenishToList` | zapis | 🕓 pending |  |
| `bulkSetPantryQuantities` | zapis | ⛔ excluded | interactive |
| `consumePantryItem` | zapis | ✅ ai |  |
| `deletePantryItem` | zapis | ✅ ai |  |
| `getAutoReplenishCandidates` | odczyt | 🕓 pending |  |
| `getExpiringSoon` | odczyt | 🕓 pending |  |
| `getPantry` | odczyt | ✅ ai |  |
| `moveItemToPantry` | zapis | 🕓 pending |  |
| `setPantryQuantity` | zapis | 🕓 pending |  |
| `updatePantryItem` | zapis | ✅ ai |  |

## petBreeding — 5/12 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `createBreedingPair` | zapis | ✅ ai |  |
| `createClutch` | zapis | ✅ ai |  |
| `createOffspring` | zapis | ✅ ai |  |
| `deleteBreedingPair` | zapis | 🕓 pending |  |
| `deleteClutch` | zapis | 🕓 pending |  |
| `deleteSale` | zapis | 🕓 pending |  |
| `getPetBreeding` | odczyt | 🕓 pending |  |
| `markClutchHatched` | zapis | ✅ ai |  |
| `recordSale` | zapis | ✅ ai |  |
| `setGenetics` | zapis | 🕓 pending |  |
| `setParentage` | zapis | 🕓 pending |  |
| `updateBreedingPair` | zapis | 🕓 pending |  |

## petCare — 9/20 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `addMeasurement` | zapis | ✅ ai |  |
| `completeCareTask` | zapis | ✅ ai |  |
| `completeTreatment` | zapis | ✅ ai |  |
| `createCareTask` | zapis | ✅ ai |  |
| `createHealthRecord` | zapis | ✅ ai |  |
| `createTreatment` | zapis | ✅ ai |  |
| `createVetVisit` | zapis | ✅ ai |  |
| `deleteCareTask` | zapis | 🕓 pending |  |
| `deleteHealthRecord` | zapis | 🕓 pending |  |
| `deleteMeasurement` | zapis | 🕓 pending |  |
| `deleteTreatment` | zapis | 🕓 pending |  |
| `deleteVetVisit` | zapis | 🕓 pending |  |
| `getCareAgenda` | odczyt | ✅ ai | → list_care_agenda |
| `getCareHistory` | odczyt | 🕓 pending |  |
| `getPetWelfare` | odczyt | 🕓 pending |  |
| `logFeeding` | zapis | ✅ ai |  |
| `updateCareTask` | zapis | 🕓 pending |  |
| `updateHealthRecord` | zapis | 🕓 pending |  |
| `updateTreatment` | zapis | 🕓 pending |  |
| `updateVetVisit` | zapis | 🕓 pending |  |

## petHusbandry — 2/7 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `addEnvironmentReading` | zapis | ✅ ai |  |
| `assignPetToEnclosure` | zapis | 🕓 pending |  |
| `createEnclosure` | zapis | ✅ ai |  |
| `deleteEnclosure` | zapis | 🕓 pending |  |
| `deleteEnvironmentReading` | zapis | 🕓 pending |  |
| `getEnclosures` | odczyt | 🕓 pending |  |
| `updateEnclosure` | zapis | 🕓 pending |  |

## pets — 6/11 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `createPet` | zapis | ✅ ai |  |
| `deletePet` | zapis | ✅ ai |  |
| `getPet` | odczyt | ✅ ai |  |
| `getPets` | odczyt | ✅ ai |  |
| `getPetSharing` | odczyt | 🕓 pending |  |
| `removePetShare` | zapis | 🕓 pending |  |
| `setPetStatus` | zapis | ✅ ai |  |
| `sharePetByEmail` | zapis | 🕓 pending |  |
| `sharePetWithTeam` | zapis | 🕓 pending |  |
| `updatePet` | zapis | ✅ ai |  |
| `updatePetFeatures` | zapis | 🕓 pending |  |

## portfel — 7/10 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `addEntry` | zapis | ✅ ai |  |
| `archiveElement` | zapis | ✅ ai |  |
| `createElement` | zapis | ✅ ai |  |
| `deleteElement` | zapis | ✅ ai |  |
| `getElement` | odczyt | 🕓 pending |  |
| `getWalletElements` | odczyt | ✅ ai |  |
| `getWalletOverview` | odczyt | 🕓 pending |  |
| `importBankCsv` | zapis | ⛔ excluded | interactive |
| `setBalance` | zapis | ✅ ai |  |
| `updateElement` | zapis | ✅ ai |  |

## portfelAuto — 0/2 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `getFinanceSettings` | odczyt | ⛔ excluded | settings |
| `setFinanceSettings` | zapis | ⛔ excluded | settings |

## portfelBudgets — 9/9 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `contributeGoal` | zapis | ✅ ai | → contribute_goal |
| `createBudget` | zapis | ✅ ai | → create_budget |
| `createGoal` | zapis | ✅ ai | → create_goal |
| `deleteBudget` | zapis | ✅ ai | → delete_budget |
| `deleteGoal` | zapis | ✅ ai | → delete_goal |
| `getBudgetsWithSpending` | odczyt | ✅ ai | → list_budgets |
| `getFinanceGoals` | odczyt | ✅ ai | → list_goals |
| `updateBudget` | zapis | ✅ ai | → update_budget |
| `updateGoal` | zapis | ✅ ai | → update_goal |

## portfelCurrency — 0/5 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `deleteExchangeRate` | zapis | ⛔ excluded | settings |
| `getCurrencySettings` | odczyt | ⛔ excluded | settings |
| `refreshRatesFromNBP` | zapis | ⛔ excluded | settings |
| `setBaseCurrency` | zapis | ⛔ excluded | settings |
| `setExchangeRate` | zapis | ⛔ excluded | settings |

## portfelReports — 0/1 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `getMonthlyReport` | odczyt | 🕓 pending |  |

## privacy — 0/2 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `deleteMyAccount` | zapis | ⛔ excluded | account |
| `exportMyData` | zapis | ⛔ excluded | account |

## products — 0/7 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `copyGlobalProduct` | zapis | 🕓 pending |  |
| `createProduct` | zapis | 🕓 pending |  |
| `deleteProduct` | zapis | 🕓 pending |  |
| `getProducts` | odczyt | 🕓 pending |  |
| `getProductSuggestions` | odczyt | 🕓 pending |  |
| `updateProduct` | zapis | 🕓 pending |  |
| `upsertUserProduct` | zapis | 🕓 pending |  |

## projectGroups — 0/5 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `createProjectGroup` | zapis | 🕓 pending |  |
| `deleteProjectGroup` | zapis | 🕓 pending |  |
| `getProjectGroup` | odczyt | 🕓 pending |  |
| `getProjectGroups` | odczyt | 🕓 pending |  |
| `updateProjectGroup` | zapis | 🕓 pending |  |

## qa — 0/16 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `createEpic` | zapis | ⛔ excluded | admin |
| `createScenario` | zapis | ⛔ excluded | admin |
| `createStory` | zapis | ⛔ excluded | admin |
| `deleteEpic` | zapis | ⛔ excluded | admin |
| `deleteScenario` | zapis | ⛔ excluded | admin |
| `deleteStory` | zapis | ⛔ excluded | admin |
| `getAllEpics` | odczyt | ⛔ excluded | admin |
| `getEpicForAdmin` | odczyt | ⛔ excluded | admin |
| `getModuleStats` | odczyt | ⛔ excluded | admin |
| `getModuleTree` | odczyt | ⛔ excluded | admin |
| `getScenarioForAdmin` | odczyt | ⛔ excluded | admin |
| `getScenarioWithContext` | odczyt | ⛔ excluded | admin |
| `getStoryForAdmin` | odczyt | ⛔ excluded | admin |
| `updateEpic` | zapis | ⛔ excluded | admin |
| `updateScenario` | zapis | ⛔ excluded | admin |
| `updateStory` | zapis | ⛔ excluded | admin |

## recipes — 4/20 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `addIngredient` | zapis | 🕓 pending |  |
| `addRecipeImage` | zapis | ⛔ excluded | interactive |
| `addStep` | zapis | 🕓 pending |  |
| `archiveRecipe` | zapis | 🕓 pending |  |
| `createRecipe` | zapis | ✅ ai |  |
| `deleteIngredient` | zapis | 🕓 pending |  |
| `deleteRecipe` | zapis | ✅ ai |  |
| `deleteRecipeImage` | zapis | ⛔ excluded | interactive |
| `deleteStep` | zapis | 🕓 pending |  |
| `duplicateRecipe` | zapis | 🕓 pending |  |
| `getRecipe` | odczyt | ✅ ai | → get_recipe |
| `getRecipes` | odczyt | ✅ ai |  |
| `markRecipeCooked` | zapis | 🕓 pending |  |
| `reorderIngredients` | zapis | ⛔ excluded | interactive |
| `reorderSteps` | zapis | ⛔ excluded | interactive |
| `shopForRecipe` | zapis | 🕓 pending |  |
| `updateIngredient` | zapis | 🕓 pending |  |
| `updateRecipe` | zapis | 🕓 pending |  |
| `updateRecipeImage` | zapis | ⛔ excluded | interactive |
| `updateStep` | zapis | 🕓 pending |  |

## reports — 1/9 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `createReport` | zapis | ⛔ excluded | admin |
| `createUserReport` | zapis | ✅ ai |  |
| `deleteReport` | zapis | ⛔ excluded | admin |
| `getReport` | odczyt | 🕓 pending |  |
| `getReportsMeta` | odczyt | 🕓 pending |  |
| `getUserReport` | odczyt | 🕓 pending |  |
| `getUserReportsMeta` | odczyt | 🕓 pending |  |
| `searchReports` | odczyt | 🕓 pending |  |
| `updateReport` | zapis | ⛔ excluded | admin |

## shoppingSync — 0/1 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `syncShoppingMutations` | zapis | ⛔ excluded | internal |

## skins — 0/7 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `createSkin` | zapis | ⛔ excluded | admin |
| `deleteSkin` | zapis | ⛔ excluded | admin |
| `duplicateSkin` | zapis | ⛔ excluded | admin |
| `getActiveSkinId` | odczyt | ⛔ excluded | settings |
| `listAvailableSkins` | odczyt | ⛔ excluded | settings |
| `setActiveSkin` | zapis | ⛔ excluded | admin |
| `updateSkin` | zapis | ⛔ excluded | admin |

## storage — 6/31 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `addBatch` | zapis | 🕓 pending |  |
| `addLowStockToShoppingList` | zapis | 🕓 pending |  |
| `addStorageItem` | zapis | ✅ ai |  |
| `addSupplier` | zapis | 🕓 pending |  |
| `adjustStorageQuantity` | zapis | ✅ ai |  |
| `bulkAddStorageItems` | zapis | ⛔ excluded | interactive |
| `bulkSetStorageQuantities` | zapis | ⛔ excluded | interactive |
| `createDocument` | zapis | 🕓 pending |  |
| `createPurchaseOrder` | zapis | 🕓 pending |  |
| `deleteBatch` | zapis | 🕓 pending |  |
| `deleteDocument` | zapis | 🕓 pending |  |
| `deletePurchaseOrder` | zapis | 🕓 pending |  |
| `deleteStorageItem` | zapis | ✅ ai |  |
| `deleteSupplier` | zapis | 🕓 pending |  |
| `getDocument` | odczyt | ⛔ excluded | interactive |
| `getDocuments` | odczyt | ⛔ excluded | interactive |
| `getExpiringStorage` | odczyt | 🕓 pending |  |
| `getLowStock` | odczyt | 🕓 pending |  |
| `getPurchaseOrder` | odczyt | ⛔ excluded | interactive |
| `getPurchaseOrders` | odczyt | ⛔ excluded | interactive |
| `getStorageAnalytics` | odczyt | 🕓 pending |  |
| `getStorageItem` | odczyt | 🕓 pending |  |
| `getStorageItems` | odczyt | ✅ ai |  |
| `getStorageSettings` | odczyt | ⛔ excluded | settings |
| `getSuppliers` | odczyt | 🕓 pending |  |
| `setStorageCurrency` | zapis | ⛔ excluded | admin |
| `setStorageMode` | zapis | ⛔ excluded | admin |
| `transferStock` | zapis | ✅ ai |  |
| `updatePurchaseOrder` | zapis | 🕓 pending |  |
| `updateStorageItem` | zapis | ✅ ai |  |
| `updateSupplier` | zapis | 🕓 pending |  |

## stores — 0/10 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `createStore` | zapis | ⛔ excluded | interactive |
| `deleteStore` | zapis | ⛔ excluded | interactive |
| `deleteStoreEdge` | zapis | ⛔ excluded | interactive |
| `deleteStoreNode` | zapis | ⛔ excluded | interactive |
| `getStore` | odczyt | ⛔ excluded | interactive |
| `getStores` | odczyt | ⛔ excluded | interactive |
| `renameStore` | zapis | ⛔ excluded | interactive |
| `saveStoreGraph` | zapis | ⛔ excluded | interactive |
| `upsertStoreEdge` | zapis | ⛔ excluded | interactive |
| `upsertStoreNode` | zapis | ⛔ excluded | interactive |

## systemHealth — 0/1 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `getSystemHealth` | odczyt | ⛔ excluded | settings |

## tags — 1/4 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `createTag` | zapis | 🕓 pending |  |
| `deleteTag` | zapis | 🕓 pending |  |
| `getTags` | odczyt | ✅ ai | → list_note_tags |
| `updateTag` | zapis | 🕓 pending |  |

## taskProjects — 4/7 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `addProjectMember` | zapis | 🕓 pending |  |
| `createTaskProject` | zapis | ✅ ai |  |
| `deleteTaskProject` | zapis | ✅ ai |  |
| `getTaskProjects` | odczyt | ✅ ai |  |
| `removeProjectMember` | zapis | 🕓 pending |  |
| `updateTaskProject` | zapis | ✅ ai |  |
| `updateTaskProjectStatusConfig` | zapis | 🕓 pending |  |

## taskTags — 1/4 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `createTaskTag` | zapis | 🕓 pending |  |
| `deleteTaskTag` | zapis | 🕓 pending |  |
| `getTaskTags` | odczyt | ✅ ai | → list_task_tags |
| `updateTaskTag` | zapis | 🕓 pending |  |

## tasks — 10/18 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `addTaskComment` | zapis | 🕓 pending |  |
| `completeRecurringTask` | zapis | 🕓 pending |  |
| `createTask` | zapis | ✅ ai |  |
| `deleteTask` | zapis | ✅ ai |  |
| `deleteTaskComment` | zapis | 🕓 pending |  |
| `getAllUserTasks` | odczyt | ✅ ai |  |
| `getOverdueTasks` | odczyt | ✅ ai |  |
| `getTask` | odczyt | ✅ ai |  |
| `getTasks` | odczyt | ✅ ai |  |
| `getTasksForProjects` | odczyt | ✅ ai |  |
| `getTodayTasks` | odczyt | ✅ ai |  |
| `removeTaskShare` | zapis | 🕓 pending |  |
| `reorderTask` | zapis | ⛔ excluded | interactive |
| `shareTask` | zapis | 🕓 pending |  |
| `shareTaskByEmail` | zapis | 🕓 pending |  |
| `toggleTaskStatus` | zapis | 🕓 pending |  |
| `updateTask` | zapis | ✅ ai |  |
| `updateTaskTags` | zapis | ✅ ai | → set_task_tags |

## teams — 0/12 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `changeMemberRole` | zapis | ⛔ excluded | teams |
| `createSubTeam` | zapis | ⛔ excluded | teams |
| `createTeam` | zapis | ⛔ excluded | teams |
| `deleteTeam` | zapis | ⛔ excluded | teams |
| `getHouseholdOnboarding` | odczyt | ⛔ excluded | teams |
| `getMyTeams` | odczyt | ⛔ excluded | teams |
| `getTeam` | odczyt | ⛔ excluded | teams |
| `leaveTeam` | zapis | ⛔ excluded | teams |
| `removeMember` | zapis | ⛔ excluded | teams |
| `setMemberModuleAccess` | zapis | ⛔ excluded | teams |
| `transferTeamOwnership` | zapis | ⛔ excluded | teams |
| `updateTeam` | zapis | ⛔ excluded | teams |

## trash — 1/4 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `emptyTrash` | zapis | 🕓 pending |  |
| `getTrash` | odczyt | ✅ ai | → list_trash |
| `purgeTrashItem` | zapis | 🕓 pending |  |
| `restoreTrashItem` | zapis | 🕓 pending |  |

## truck — 0/3 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `getVehicleProfile` | odczyt | 🕓 pending |  |
| `planTruckRoute` | zapis | 🕓 pending |  |
| `saveVehicleProfile` | zapis | 🕓 pending |  |

## units — 0/5 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `createUnit` | zapis | 🕓 pending |  |
| `deleteUnit` | zapis | 🕓 pending |  |
| `getUnits` | odczyt | 🕓 pending |  |
| `getUnitSuggestions` | odczyt | 🕓 pending |  |
| `renameUnit` | zapis | 🕓 pending |  |

## warsztat — 5/16 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `addSuggestedItems` | zapis | 🕓 pending |  |
| `addWorkshopItem` | zapis | ✅ ai |  |
| `addWorkshopProject` | zapis | 🕓 pending |  |
| `adjustWorkshopItemQuantity` | zapis | 🕓 pending |  |
| `createWorkshop` | zapis | ✅ ai |  |
| `deleteWorkshop` | zapis | 🕓 pending |  |
| `deleteWorkshopItem` | zapis | 🕓 pending |  |
| `deleteWorkshopProject` | zapis | 🕓 pending |  |
| `getMaintenanceOverview` | odczyt | ✅ ai | → list_maintenance |
| `getWarsztatSettings` | odczyt | ⛔ excluded | settings |
| `getWorkshop` | odczyt | ✅ ai |  |
| `getWorkshops` | odczyt | ✅ ai |  |
| `setWarsztatMode` | zapis | ⛔ excluded | admin |
| `updateWorkshop` | zapis | 🕓 pending |  |
| `updateWorkshopItem` | zapis | 🕓 pending |  |
| `updateWorkshopProject` | zapis | 🕓 pending |  |

## weather — 7/11 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `addCustomWatcher` | zapis | 🕓 pending |  |
| `addLocation` | zapis | 🕓 pending |  |
| `addLocationByName` | zapis | ✅ ai |  |
| `addPresetWatcher` | zapis | ✅ ai |  |
| `deleteLocation` | zapis | ✅ ai |  |
| `deleteWatcher` | zapis | ✅ ai |  |
| `getLocations` | odczyt | ✅ ai |  |
| `getWatchers` | odczyt | 🕓 pending |  |
| `getWeather` | odczyt | ✅ ai | → get_weather |
| `setDefaultLocation` | zapis | ✅ ai |  |
| `updateWatcher` | zapis | 🕓 pending |  |

