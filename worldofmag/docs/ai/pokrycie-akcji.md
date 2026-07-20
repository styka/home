# Pokrycie akcji użytkownika przez asystenta AI

> Plik generowany przez `scripts/check-ai-coverage.js --report`. Nie edytuj ręcznie.

Mutacje (zapis): **159 ai / 0 pending / 184 excluded**. Odczyty (podgląd danych): **64 ai / 0 pending / 81 excluded**.

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
| `createCategory` | zapis | ⛔ excluded | dictionary |
| `deleteCategory` | zapis | ⛔ excluded | dictionary |
| `getCategories` | odczyt | ⛔ excluded | dictionary |
| `getCategoryEmojiMap` | odczyt | ⛔ excluded | dictionary |
| `getCategoryNames` | odczyt | ⛔ excluded | dictionary |
| `updateCategory` | zapis | ⛔ excluded | dictionary |

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

## cookbooks — 4/5 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `createCookbook` | zapis | ✅ ai | → create_cookbook |
| `deleteCookbook` | zapis | ✅ ai | → delete_cookbook |
| `getCookbook` | odczyt | ⛔ excluded | redundant |
| `getCookbooks` | odczyt | ✅ ai | → list_cookbooks |
| `updateCookbook` | zapis | ✅ ai | → update_cookbook |

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
| `deleteFuelLog` | zapis | ⛔ excluded | interactive |
| `deleteServiceRecord` | zapis | ⛔ excluded | interactive |
| `deleteVehicle` | zapis | ✅ ai |  |
| `deleteVehicleAttachment` | zapis | ⛔ excluded | interactive |
| `getVehicle` | odczyt | ✅ ai |  |
| `getVehicles` | odczyt | ✅ ai |  |
| `updateVehicle` | zapis | ✅ ai |  |

## habits — 7/8 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `createHabit` | zapis | ✅ ai |  |
| `createTaskFromHabit` | zapis | ✅ ai | → create_task_from_habit |
| `deleteHabit` | zapis | ✅ ai |  |
| `getHabits` | odczyt | ✅ ai |  |
| `reorderHabits` | zapis | ⛔ excluded | interactive |
| `setHabitArchived` | zapis | ✅ ai |  |
| `toggleHabitDay` | zapis | ✅ ai |  |
| `updateHabit` | zapis | ✅ ai |  |

## health — 6/11 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `addHealthAttachment` | zapis | ⛔ excluded | interactive |
| `createHealthEvent` | zapis | ✅ ai |  |
| `deleteHealthAttachment` | zapis | ⛔ excluded | interactive |
| `deleteHealthEvent` | zapis | ✅ ai |  |
| `getHealthAttachments` | odczyt | ⛔ excluded | interactive |
| `getHealthEvents` | odczyt | ✅ ai |  |
| `getHealthSettings` | odczyt | ⛔ excluded | settings |
| `getTestTrends` | odczyt | ✅ ai | → get_test_trends |
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

## languageDecks — 10/12 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `addWord` | zapis | ✅ ai |  |
| `bulkAddWords` | zapis | ✅ ai | → bulk_add_words |
| `createDeck` | zapis | ✅ ai |  |
| `deleteDeck` | zapis | ✅ ai |  |
| `deleteWord` | zapis | ✅ ai |  |
| `getDeck` | odczyt | ⛔ excluded | redundant |
| `getDecks` | odczyt | ✅ ai |  |
| `getDueCards` | odczyt | ✅ ai | → list_due_cards |
| `getStudyStreak` | odczyt | ✅ ai | → get_study_streak |
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

## mealPlans — 10/11 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `bulkSetMealPlan` | zapis | ⛔ excluded | interactive |
| `deleteMealPlanEntry` | zapis | ✅ ai |  |
| `generateShoppingListFromPlan` | zapis | ✅ ai | → generate_shopping_from_plan |
| `getMealPlan` | odczyt | ✅ ai |  |
| `getMealPlanCost` | odczyt | ✅ ai | → get_meal_plan_cost |
| `getTodaysMeals` | odczyt | ✅ ai | → list_todays_meals |
| `markMealCooked` | zapis | ✅ ai |  |
| `markMealSkipped` | zapis | ✅ ai | → mark_meal_skipped |
| `moveMealPlanEntry` | zapis | ✅ ai | → move_meal_plan_entry |
| `setMealPlanEntry` | zapis | ✅ ai |  |
| `updateMealPlanEntry` | zapis | ✅ ai | → update_meal_plan_entry |

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

## news — 11/18 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `acknowledgeItem` | zapis | ⛔ excluded | interactive |
| `createSource` | zapis | ✅ ai | → create_news_source |
| `createTopic` | zapis | ✅ ai |  |
| `deleteSource` | zapis | ✅ ai | → delete_news_source |
| `deleteTopic` | zapis | ✅ ai |  |
| `dismissItem` | zapis | ⛔ excluded | interactive |
| `getHotTopics` | odczyt | ✅ ai | → list_hot_topics |
| `getKnowledgeHistory` | odczyt | ⛔ excluded | niche |
| `getNewsPref` | odczyt | ⛔ excluded | settings |
| `getSources` | odczyt | ✅ ai | → list_news_sources |
| `getTopics` | odczyt | ✅ ai |  |
| `getTopicView` | odczyt | ✅ ai | → get_news_topic_view |
| `refreshTopic` | zapis | ✅ ai |  |
| `resummarizeItem` | zapis | ⛔ excluded | interactive |
| `setActiveSource` | zapis | ⛔ excluded | admin |
| `setDefaultSummaryLength` | zapis | ⛔ excluded | admin |
| `updateSource` | zapis | ✅ ai | → update_news_source |
| `updateTopic` | zapis | ✅ ai |  |

## noteGroups — 4/4 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `createNoteGroup` | zapis | ✅ ai | → create_note_group |
| `deleteNoteGroup` | zapis | ✅ ai | → delete_note_group |
| `getNoteGroups` | odczyt | ✅ ai | → list_note_groups |
| `updateNoteGroup` | zapis | ✅ ai | → update_note_group |

## notes — 6/13 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `addNoteAttachment` | zapis | ⛔ excluded | interactive |
| `addTagToNote` | zapis | ⛔ excluded | redundant |
| `createNote` | zapis | ✅ ai |  |
| `deleteNote` | zapis | ✅ ai |  |
| `deleteNoteAttachment` | zapis | ⛔ excluded | interactive |
| `getNoteAttachments` | odczyt | ⛔ excluded | interactive |
| `getNoteRevisions` | odczyt | ⛔ excluded | interactive |
| `getNotes` | odczyt | ✅ ai |  |
| `removeTagFromNote` | zapis | ⛔ excluded | redundant |
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

## pantry — 10/11 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `addPantryItem` | zapis | ✅ ai |  |
| `autoReplenishToList` | zapis | ✅ ai | → auto_replenish_pantry |
| `bulkSetPantryQuantities` | zapis | ⛔ excluded | interactive |
| `consumePantryItem` | zapis | ✅ ai |  |
| `deletePantryItem` | zapis | ✅ ai |  |
| `getAutoReplenishCandidates` | odczyt | ✅ ai | → list_replenish_candidates |
| `getExpiringSoon` | odczyt | ✅ ai | → list_expiring_pantry |
| `getPantry` | odczyt | ✅ ai |  |
| `moveItemToPantry` | zapis | ✅ ai | → move_item_to_pantry |
| `setPantryQuantity` | zapis | ✅ ai | → set_pantry_quantity |
| `updatePantryItem` | zapis | ✅ ai |  |

## petBreeding — 5/12 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `createBreedingPair` | zapis | ✅ ai |  |
| `createClutch` | zapis | ✅ ai |  |
| `createOffspring` | zapis | ✅ ai |  |
| `deleteBreedingPair` | zapis | ⛔ excluded | interactive |
| `deleteClutch` | zapis | ⛔ excluded | interactive |
| `deleteSale` | zapis | ⛔ excluded | interactive |
| `getPetBreeding` | odczyt | ⛔ excluded | niche |
| `markClutchHatched` | zapis | ✅ ai |  |
| `recordSale` | zapis | ✅ ai |  |
| `setGenetics` | zapis | ⛔ excluded | interactive |
| `setParentage` | zapis | ⛔ excluded | interactive |
| `updateBreedingPair` | zapis | ⛔ excluded | interactive |

## petCare — 11/20 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `addMeasurement` | zapis | ✅ ai |  |
| `completeCareTask` | zapis | ✅ ai |  |
| `completeTreatment` | zapis | ✅ ai |  |
| `createCareTask` | zapis | ✅ ai |  |
| `createHealthRecord` | zapis | ✅ ai |  |
| `createTreatment` | zapis | ✅ ai |  |
| `createVetVisit` | zapis | ✅ ai |  |
| `deleteCareTask` | zapis | ⛔ excluded | interactive |
| `deleteHealthRecord` | zapis | ⛔ excluded | interactive |
| `deleteMeasurement` | zapis | ⛔ excluded | interactive |
| `deleteTreatment` | zapis | ⛔ excluded | interactive |
| `deleteVetVisit` | zapis | ⛔ excluded | interactive |
| `getCareAgenda` | odczyt | ✅ ai | → list_care_agenda |
| `getCareHistory` | odczyt | ✅ ai | → list_care_history |
| `getPetWelfare` | odczyt | ✅ ai | → get_pet_welfare |
| `logFeeding` | zapis | ✅ ai |  |
| `updateCareTask` | zapis | ⛔ excluded | interactive |
| `updateHealthRecord` | zapis | ⛔ excluded | interactive |
| `updateTreatment` | zapis | ⛔ excluded | interactive |
| `updateVetVisit` | zapis | ⛔ excluded | interactive |

## petHusbandry — 6/7 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `addEnvironmentReading` | zapis | ✅ ai |  |
| `assignPetToEnclosure` | zapis | ✅ ai | → assign_pet_to_enclosure |
| `createEnclosure` | zapis | ✅ ai |  |
| `deleteEnclosure` | zapis | ✅ ai | → delete_enclosure |
| `deleteEnvironmentReading` | zapis | ⛔ excluded | interactive |
| `getEnclosures` | odczyt | ✅ ai | → list_enclosures |
| `updateEnclosure` | zapis | ✅ ai | → update_enclosure |

## pets — 6/11 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `createPet` | zapis | ✅ ai |  |
| `deletePet` | zapis | ✅ ai |  |
| `getPet` | odczyt | ✅ ai |  |
| `getPets` | odczyt | ✅ ai |  |
| `getPetSharing` | odczyt | ⛔ excluded | teams |
| `removePetShare` | zapis | ⛔ excluded | teams |
| `setPetStatus` | zapis | ✅ ai |  |
| `sharePetByEmail` | zapis | ⛔ excluded | teams |
| `sharePetWithTeam` | zapis | ⛔ excluded | teams |
| `updatePet` | zapis | ✅ ai |  |
| `updatePetFeatures` | zapis | ⛔ excluded | interactive |

## portfel — 8/10 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `addEntry` | zapis | ✅ ai |  |
| `archiveElement` | zapis | ✅ ai |  |
| `createElement` | zapis | ✅ ai |  |
| `deleteElement` | zapis | ✅ ai |  |
| `getElement` | odczyt | ⛔ excluded | redundant |
| `getWalletElements` | odczyt | ✅ ai |  |
| `getWalletOverview` | odczyt | ✅ ai | → get_wallet_overview |
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

## portfelReports — 1/1 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `getMonthlyReport` | odczyt | ✅ ai | → get_monthly_report |

## privacy — 0/2 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `deleteMyAccount` | zapis | ⛔ excluded | account |
| `exportMyData` | zapis | ⛔ excluded | account |

## products — 0/7 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `copyGlobalProduct` | zapis | ⛔ excluded | dictionary |
| `createProduct` | zapis | ⛔ excluded | dictionary |
| `deleteProduct` | zapis | ⛔ excluded | dictionary |
| `getProducts` | odczyt | ⛔ excluded | dictionary |
| `getProductSuggestions` | odczyt | ⛔ excluded | dictionary |
| `updateProduct` | zapis | ⛔ excluded | dictionary |
| `upsertUserProduct` | zapis | ⛔ excluded | dictionary |

## projectGroups — 4/5 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `createProjectGroup` | zapis | ✅ ai | → create_project_group |
| `deleteProjectGroup` | zapis | ✅ ai | → delete_project_group |
| `getProjectGroup` | odczyt | ⛔ excluded | redundant |
| `getProjectGroups` | odczyt | ✅ ai | → list_project_groups |
| `updateProjectGroup` | zapis | ✅ ai | → update_project_group |

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

## recipes — 11/20 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `addIngredient` | zapis | ✅ ai | → add_ingredient |
| `addRecipeImage` | zapis | ⛔ excluded | interactive |
| `addStep` | zapis | ✅ ai | → add_step |
| `archiveRecipe` | zapis | ✅ ai | → archive_recipe |
| `createRecipe` | zapis | ✅ ai |  |
| `deleteIngredient` | zapis | ⛔ excluded | interactive |
| `deleteRecipe` | zapis | ✅ ai |  |
| `deleteRecipeImage` | zapis | ⛔ excluded | interactive |
| `deleteStep` | zapis | ⛔ excluded | interactive |
| `duplicateRecipe` | zapis | ✅ ai | → duplicate_recipe |
| `getRecipe` | odczyt | ✅ ai | → get_recipe |
| `getRecipes` | odczyt | ✅ ai |  |
| `markRecipeCooked` | zapis | ✅ ai | → mark_recipe_cooked |
| `reorderIngredients` | zapis | ⛔ excluded | interactive |
| `reorderSteps` | zapis | ⛔ excluded | interactive |
| `shopForRecipe` | zapis | ✅ ai | → shop_for_recipe |
| `updateIngredient` | zapis | ⛔ excluded | interactive |
| `updateRecipe` | zapis | ✅ ai | → update_recipe |
| `updateRecipeImage` | zapis | ⛔ excluded | interactive |
| `updateStep` | zapis | ⛔ excluded | interactive |

## reports — 2/9 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `createReport` | zapis | ⛔ excluded | admin |
| `createUserReport` | zapis | ✅ ai |  |
| `deleteReport` | zapis | ⛔ excluded | admin |
| `getReport` | odczyt | ⛔ excluded | redundant |
| `getReportsMeta` | odczyt | ⛔ excluded | redundant |
| `getUserReport` | odczyt | ⛔ excluded | redundant |
| `getUserReportsMeta` | odczyt | ⛔ excluded | redundant |
| `searchReports` | odczyt | ✅ ai | → search_reports |
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

## storage — 15/31 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `addBatch` | zapis | ✅ ai | → add_batch |
| `addLowStockToShoppingList` | zapis | ✅ ai | → add_low_stock_to_shopping |
| `addStorageItem` | zapis | ✅ ai |  |
| `addSupplier` | zapis | ✅ ai | → add_supplier |
| `adjustStorageQuantity` | zapis | ✅ ai |  |
| `bulkAddStorageItems` | zapis | ⛔ excluded | interactive |
| `bulkSetStorageQuantities` | zapis | ⛔ excluded | interactive |
| `createDocument` | zapis | ⛔ excluded | interactive |
| `createPurchaseOrder` | zapis | ⛔ excluded | interactive |
| `deleteBatch` | zapis | ⛔ excluded | interactive |
| `deleteDocument` | zapis | ⛔ excluded | interactive |
| `deletePurchaseOrder` | zapis | ⛔ excluded | interactive |
| `deleteStorageItem` | zapis | ✅ ai |  |
| `deleteSupplier` | zapis | ✅ ai | → delete_supplier |
| `getDocument` | odczyt | ⛔ excluded | interactive |
| `getDocuments` | odczyt | ⛔ excluded | interactive |
| `getExpiringStorage` | odczyt | ✅ ai | → list_expiring_storage |
| `getLowStock` | odczyt | ✅ ai | → list_low_stock |
| `getPurchaseOrder` | odczyt | ⛔ excluded | interactive |
| `getPurchaseOrders` | odczyt | ⛔ excluded | interactive |
| `getStorageAnalytics` | odczyt | ✅ ai | → get_storage_analytics |
| `getStorageItem` | odczyt | ⛔ excluded | redundant |
| `getStorageItems` | odczyt | ✅ ai |  |
| `getStorageSettings` | odczyt | ⛔ excluded | settings |
| `getSuppliers` | odczyt | ✅ ai | → list_suppliers |
| `setStorageCurrency` | zapis | ⛔ excluded | admin |
| `setStorageMode` | zapis | ⛔ excluded | admin |
| `transferStock` | zapis | ✅ ai |  |
| `updatePurchaseOrder` | zapis | ⛔ excluded | interactive |
| `updateStorageItem` | zapis | ✅ ai |  |
| `updateSupplier` | zapis | ✅ ai | → update_supplier |

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
| `createTag` | zapis | ⛔ excluded | dictionary |
| `deleteTag` | zapis | ⛔ excluded | dictionary |
| `getTags` | odczyt | ✅ ai | → list_note_tags |
| `updateTag` | zapis | ⛔ excluded | dictionary |

## taskProjects — 4/7 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `addProjectMember` | zapis | ⛔ excluded | teams |
| `createTaskProject` | zapis | ✅ ai |  |
| `deleteTaskProject` | zapis | ✅ ai |  |
| `getTaskProjects` | odczyt | ✅ ai |  |
| `removeProjectMember` | zapis | ⛔ excluded | teams |
| `updateTaskProject` | zapis | ✅ ai |  |
| `updateTaskProjectStatusConfig` | zapis | ⛔ excluded | settings |

## taskTags — 1/4 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `createTaskTag` | zapis | ⛔ excluded | dictionary |
| `deleteTaskTag` | zapis | ⛔ excluded | dictionary |
| `getTaskTags` | odczyt | ✅ ai | → list_task_tags |
| `updateTaskTag` | zapis | ⛔ excluded | dictionary |

## tasks — 11/18 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `addTaskComment` | zapis | ✅ ai | → add_task_comment |
| `completeRecurringTask` | zapis | ⛔ excluded | internal |
| `createTask` | zapis | ✅ ai |  |
| `deleteTask` | zapis | ✅ ai |  |
| `deleteTaskComment` | zapis | ⛔ excluded | interactive |
| `getAllUserTasks` | odczyt | ✅ ai |  |
| `getOverdueTasks` | odczyt | ✅ ai |  |
| `getTask` | odczyt | ✅ ai |  |
| `getTasks` | odczyt | ✅ ai |  |
| `getTasksForProjects` | odczyt | ✅ ai |  |
| `getTodayTasks` | odczyt | ✅ ai |  |
| `removeTaskShare` | zapis | ⛔ excluded | teams |
| `reorderTask` | zapis | ⛔ excluded | interactive |
| `shareTask` | zapis | ⛔ excluded | teams |
| `shareTaskByEmail` | zapis | ⛔ excluded | teams |
| `toggleTaskStatus` | zapis | ⛔ excluded | redundant |
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
| `emptyTrash` | zapis | ⛔ excluded | interactive |
| `getTrash` | odczyt | ✅ ai | → list_trash |
| `purgeTrashItem` | zapis | ⛔ excluded | interactive |
| `restoreTrashItem` | zapis | ⛔ excluded | interactive |

## truck — 0/3 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `getVehicleProfile` | odczyt | ⛔ excluded | niche |
| `planTruckRoute` | zapis | ⛔ excluded | niche |
| `saveVehicleProfile` | zapis | ⛔ excluded | niche |

## units — 0/5 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `createUnit` | zapis | ⛔ excluded | dictionary |
| `deleteUnit` | zapis | ⛔ excluded | dictionary |
| `getUnits` | odczyt | ⛔ excluded | dictionary |
| `getUnitSuggestions` | odczyt | ⛔ excluded | dictionary |
| `renameUnit` | zapis | ⛔ excluded | dictionary |

## warsztat — 13/16 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `addSuggestedItems` | zapis | ⛔ excluded | interactive |
| `addWorkshopItem` | zapis | ✅ ai |  |
| `addWorkshopProject` | zapis | ✅ ai | → add_workshop_project |
| `adjustWorkshopItemQuantity` | zapis | ✅ ai | → adjust_workshop_item |
| `createWorkshop` | zapis | ✅ ai |  |
| `deleteWorkshop` | zapis | ✅ ai | → delete_workshop |
| `deleteWorkshopItem` | zapis | ✅ ai | → delete_workshop_item |
| `deleteWorkshopProject` | zapis | ✅ ai | → delete_workshop_project |
| `getMaintenanceOverview` | odczyt | ✅ ai | → list_maintenance |
| `getWarsztatSettings` | odczyt | ⛔ excluded | settings |
| `getWorkshop` | odczyt | ✅ ai |  |
| `getWorkshops` | odczyt | ✅ ai |  |
| `setWarsztatMode` | zapis | ⛔ excluded | admin |
| `updateWorkshop` | zapis | ✅ ai | → update_workshop |
| `updateWorkshopItem` | zapis | ✅ ai | → update_workshop_item |
| `updateWorkshopProject` | zapis | ✅ ai | → update_workshop_project |

## weather — 10/11 wystawionych

| Akcja | Rodzaj | Status | Uwaga |
|---|---|---|---|
| `addCustomWatcher` | zapis | ✅ ai | → add_custom_watcher |
| `addLocation` | zapis | ⛔ excluded | redundant |
| `addLocationByName` | zapis | ✅ ai |  |
| `addPresetWatcher` | zapis | ✅ ai |  |
| `deleteLocation` | zapis | ✅ ai |  |
| `deleteWatcher` | zapis | ✅ ai |  |
| `getLocations` | odczyt | ✅ ai |  |
| `getWatchers` | odczyt | ✅ ai | → list_watchers |
| `getWeather` | odczyt | ✅ ai | → get_weather |
| `setDefaultLocation` | zapis | ✅ ai |  |
| `updateWatcher` | zapis | ✅ ai | → update_watcher |

