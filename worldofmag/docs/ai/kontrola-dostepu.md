# Kontrola dostępu do akcji użytkownika

> Plik generowany przez `node scripts/check-ai-coverage.js --report`. Nie edytuj ręcznie.

Każda akcja odczytu i mutacji w `src/actions/*` ma zadeklarowany zakres dostępu, a bramka
sprawdza dodatkowo, czy w jej kodzie faktycznie wywoływany jest guard. Nowa akcja bez
deklaracji albo bez guardu **przerywa build**.

Akcji objętych kontrolą: **506**. Pozycji „brak guardu": **0**.

## Model własności słowników

- `NoteGroup`, `Tag` i `ItemHistory` mają właściciela (migracja 0212). Grupy notatek i
  etykiety mogą należeć do użytkownika albo do zespołu; podpowiedzi zakupowe są prywatne.
- Rekord bez właściciela (`ownerId` i `ownerTeamId` puste) jest **systemowy**: widzi go każde
  zalogowane konto, ale zmienić może go tylko administrator.
- Unikalność nazwy etykiety i podpowiedzi zakupowej obowiązuje **w obrębie właściciela**, więc
  dwoje użytkowników może mieć wpis o tej samej nazwie.

## access

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `addUserRole` | zapis | administrator |  |
| `createPermission` | zapis | administrator |  |
| `deletePermission` | zapis | administrator |  |
| `getAuditLog` | odczyt | administrator |  |
| `getAvailableRoles` | odczyt | administrator |  |
| `getPermissions` | odczyt | administrator |  |
| `getRolePermissions` | odczyt | administrator |  |
| `getUsers` | odczyt | administrator |  |
| `removeUserRole` | zapis | administrator |  |
| `toggleRolePermission` | zapis | administrator |  |
| `updatePermission` | zapis | administrator |  |

## activity

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `getRecentActivity` | odczyt | tylko własne konto |  |
| `trackActivity` | zapis | tylko własne konto |  |

## adminCategories

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `createSystemCategory` | zapis | administrator |  |
| `deleteSystemCategory` | zapis | administrator |  |
| `getSystemCategories` | odczyt | administrator |  |
| `updateSystemCategory` | zapis | administrator |  |

## aiConversations

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `appendAiMessage` | zapis | tylko własne konto |  |
| `createAiConversation` | zapis | tylko własne konto |  |
| `deleteAiConversation` | zapis | tylko własne konto |  |
| `getAiConversation` | odczyt | tylko własne konto |  |
| `listAiConversations` | odczyt | tylko własne konto |  |
| `renameAiConversation` | zapis | tylko własne konto |  |
| `saveConversationDraft` | zapis | tylko własne konto |  |

## assistantPrefs

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `getAssistantLevelConfig` | odczyt | tylko własne konto |  |
| `getAssistantPrefs` | odczyt | tylko własne konto |  |
| `getSpeechOptions` | odczyt | tylko własne konto |  |
| `resetUserLlmPrefs` | zapis | tylko własne konto |  |
| `updateAssistantPrefs` | zapis | tylko własne konto |  |
| `updateUserLlmPref` | zapis | tylko własne konto |  |

## calendar

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `getCalendarEvents` | odczyt | właściciel / udostępnienie |  |
| `getMyIcalFeedUrl` | odczyt | tylko własne konto |  |
| `regenerateIcalFeed` | zapis | tylko własne konto |  |

## categories

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `createCategory` | zapis | właściciel / udostępnienie |  |
| `deleteCategory` | zapis | właściciel / udostępnienie |  |
| `getCategories` | odczyt | wspólny słownik (wymaga zalogowania) |  |
| `getCategoryEmojiMap` | odczyt | właściciel / udostępnienie |  |
| `getCategoryNames` | odczyt | właściciel / udostępnienie |  |
| `updateCategory` | zapis | właściciel / udostępnienie |  |

## categoryIcons

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `assignIconToCategory` | zapis | administrator |  |
| `deactivateCategoryIcon` | zapis | administrator |  |
| `deleteCategoryIconVariant` | zapis | administrator |  |
| `getActiveCategoryIconMap` | odczyt | administrator |  |
| `getAllUserIconVariants` | odczyt | administrator |  |
| `getAllUserIconVariantsFlat` | odczyt | administrator |  |
| `getCategoryIconVariants` | odczyt | administrator |  |
| `orphanCategoryIcons` | zapis | administrator |  |
| `saveAndActivateCategoryIcon` | zapis | administrator |  |
| `saveToLibrary` | zapis | administrator |  |
| `setActiveCategoryIcon` | zapis | administrator |  |
| `upsertCategoryEmojiOverride` | zapis | administrator |  |

## config

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `getConfigMasked` | odczyt | administrator |  |
| `getConfigValue` | odczyt | administrator |  |
| `setConfigValue` | zapis | administrator |  |

## contacts

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `createContact` | zapis | właściciel / udostępnienie |  |
| `deleteContact` | zapis | właściciel / udostępnienie |  |
| `getContacts` | odczyt | właściciel / udostępnienie |  |
| `updateContact` | zapis | właściciel / udostępnienie |  |

## cookbooks

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `createCookbook` | zapis | właściciel / udostępnienie |  |
| `deleteCookbook` | zapis | właściciel / udostępnienie |  |
| `getCookbook` | odczyt | właściciel / udostępnienie |  |
| `getCookbooks` | odczyt | właściciel / udostępnienie |  |
| `updateCookbook` | zapis | właściciel / udostępnienie |  |

## dashboardPrefs

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `getDashboardPrefs` | odczyt | tylko własne konto |  |
| `setDashboardPrefs` | zapis | tylko własne konto |  |

## drive

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `disconnectDrive` | zapis | tylko własne konto |  |
| `getDriveStatus` | odczyt | tylko własne konto |  |

## feedback

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `getFeedbackInboxInfo` | odczyt | tylko własne konto |  |
| `submitFeedbackTask` | zapis | świadome odstępstwo | Skrzynka zgłoszeń: KAŻDY zalogowany użytkownik może wrzucić zgłoszenie do projektu wskazanego przez administratora, ale nie zyskuje prawa jego odczytu ani modyfikacji. Jedyne odstępstwo w aplikacji — patrz src/actions/feedback.ts. |

## flota

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `addFuelLog` | zapis | właściciel / udostępnienie |  |
| `addServiceRecord` | zapis | właściciel / udostępnienie |  |
| `addVehicleAttachment` | zapis | właściciel / udostępnienie |  |
| `createVehicle` | zapis | właściciel / udostępnienie |  |
| `deleteFuelLog` | zapis | właściciel / udostępnienie |  |
| `deleteServiceRecord` | zapis | właściciel / udostępnienie |  |
| `deleteVehicle` | zapis | właściciel / udostępnienie |  |
| `deleteVehicleAttachment` | zapis | właściciel / udostępnienie |  |
| `getVehicle` | odczyt | właściciel / udostępnienie |  |
| `getVehicles` | odczyt | właściciel / udostępnienie |  |
| `updateVehicle` | zapis | właściciel / udostępnienie |  |

## habits

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `createHabit` | zapis | właściciel / udostępnienie |  |
| `createTaskFromHabit` | zapis | właściciel / udostępnienie |  |
| `deleteHabit` | zapis | właściciel / udostępnienie |  |
| `getHabits` | odczyt | właściciel / udostępnienie |  |
| `reorderHabits` | zapis | właściciel / udostępnienie |  |
| `setHabitArchived` | zapis | właściciel / udostępnienie |  |
| `toggleHabitDay` | zapis | właściciel / udostępnienie |  |
| `updateHabit` | zapis | właściciel / udostępnienie |  |

## health

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `addHealthAttachment` | zapis | właściciel / udostępnienie |  |
| `createHealthEvent` | zapis | właściciel / udostępnienie |  |
| `deleteHealthAttachment` | zapis | właściciel / udostępnienie |  |
| `deleteHealthEvent` | zapis | właściciel / udostępnienie |  |
| `getHealthAttachments` | odczyt | właściciel / udostępnienie |  |
| `getHealthEvents` | odczyt | właściciel / udostępnienie |  |
| `getHealthSettings` | odczyt | tylko własne konto |  |
| `getTestTrends` | odczyt | właściciel / udostępnienie |  |
| `setHealthAiOptIn` | zapis | administrator |  |
| `setHealthStatus` | zapis | właściciel / udostępnienie |  |
| `updateHealthEvent` | zapis | właściciel / udostępnienie |  |

## invitations

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `acceptInvitation` | zapis | właściciel / udostępnienie |  |
| `getPendingInvitations` | odczyt | właściciel / udostępnienie |  |
| `getPendingInvitationsCount` | odczyt | właściciel / udostępnienie |  |
| `inviteUser` | zapis | właściciel / udostępnienie |  |
| `rejectInvitation` | zapis | właściciel / udostępnienie |  |

## items

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `addItem` | zapis | właściciel / udostępnienie |  |
| `addItemStructured` | zapis | właściciel / udostępnienie |  |
| `clearDoneItems` | zapis | właściciel / udostępnienie |  |
| `deleteItem` | zapis | właściciel / udostępnienie |  |
| `getSuggestionsForPrefix` | odczyt | właściciel / udostępnienie |  |
| `markAllInCart` | zapis | właściciel / udostępnienie |  |
| `moveItem` | zapis | właściciel / udostępnienie |  |
| `reorderItems` | zapis | właściciel / udostępnienie |  |
| `updateItem` | zapis | właściciel / udostępnienie |  |
| `updateItemStatus` | zapis | właściciel / udostępnienie |  |

## jobs

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `cancelJobAction` | zapis | administrator |  |
| `cleanupJobsAction` | zapis | administrator |  |
| `getJobsOverview` | odczyt | administrator |  |
| `retryJobAction` | zapis | administrator |  |

## languageDecks

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `addWord` | zapis | właściciel / udostępnienie |  |
| `bulkAddWords` | zapis | właściciel / udostępnienie |  |
| `createDeck` | zapis | właściciel / udostępnienie |  |
| `deleteDeck` | zapis | właściciel / udostępnienie |  |
| `deleteWord` | zapis | właściciel / udostępnienie |  |
| `getDeck` | odczyt | właściciel / udostępnienie |  |
| `getDecks` | odczyt | właściciel / udostępnienie |  |
| `getDueCards` | odczyt | właściciel / udostępnienie |  |
| `getStudyStreak` | odczyt | właściciel / udostępnienie |  |
| `submitReview` | zapis | właściciel / udostępnienie |  |
| `updateDeck` | zapis | właściciel / udostępnienie |  |
| `updateWord` | zapis | właściciel / udostępnienie |  |

## legal

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `acceptAllCurrentConsents` | zapis | tylko własne konto |  |
| `acceptConsent` | zapis | tylko własne konto |  |
| `getMyConsents` | odczyt | tylko własne konto |  |
| `getOutstandingConsents` | odczyt | tylko własne konto |  |

## lists

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `archiveList` | zapis | właściciel / udostępnienie |  |
| `completeShopping` | zapis | właściciel / udostępnienie |  |
| `createList` | zapis | właściciel / udostępnienie |  |
| `deleteList` | zapis | właściciel / udostępnienie |  |
| `getActiveListsForOffline` | odczyt | tylko własne konto |  |
| `getArchivedLists` | odczyt | właściciel / udostępnienie |  |
| `getLists` | odczyt | właściciel / udostępnienie |  |
| `getListSummaries` | odczyt | właściciel / udostępnienie |  |
| `renameList` | zapis | właściciel / udostępnienie |  |
| `unarchiveList` | zapis | właściciel / udostępnienie |  |

## llmConfig

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `applyAnthropicProfile` | zapis | administrator |  |
| `applySpeechProvider` | zapis | administrator |  |
| `createProvider` | zapis | administrator |  |
| `deleteModelPrice` | zapis | administrator |  |
| `deleteProvider` | zapis | administrator |  |
| `getAiCostBreakdown` | odczyt | administrator |  |
| `getAssignments` | odczyt | administrator |  |
| `getCostAlertThreshold` | odczyt | administrator |  |
| `getLlmProviders` | odczyt | administrator |  |
| `getModelPrices` | odczyt | administrator |  |
| `getRecentAiCalls` | odczyt | administrator |  |
| `getSpeechConfig` | odczyt | administrator |  |
| `getUsdPlnRate` | odczyt | administrator |  |
| `setAssignment` | zapis | administrator |  |
| `setCostAlertThreshold` | zapis | administrator |  |
| `setModelPrice` | zapis | administrator |  |
| `setUsdPlnRate` | zapis | administrator |  |
| `updateProvider` | zapis | administrator |  |

## mealPlans

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `bulkSetMealPlan` | zapis | właściciel / udostępnienie |  |
| `deleteMealPlanEntry` | zapis | właściciel / udostępnienie |  |
| `generateShoppingListFromPlan` | zapis | właściciel / udostępnienie |  |
| `getMealPlan` | odczyt | właściciel / udostępnienie |  |
| `getMealPlanCost` | odczyt | właściciel / udostępnienie |  |
| `getTodaysMeals` | odczyt | właściciel / udostępnienie |  |
| `markMealCooked` | zapis | właściciel / udostępnienie |  |
| `markMealSkipped` | zapis | właściciel / udostępnienie |  |
| `moveMealPlanEntry` | zapis | właściciel / udostępnienie |  |
| `setMealPlanEntry` | zapis | właściciel / udostępnienie |  |
| `updateMealPlanEntry` | zapis | właściciel / udostępnienie |  |

## medications

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `createMedicationSchedule` | zapis | właściciel / udostępnienie |  |
| `deleteMedicationSchedule` | zapis | właściciel / udostępnienie |  |
| `getMedicationDay` | odczyt | właściciel / udostępnienie |  |
| `getMedicationSchedules` | odczyt | właściciel / udostępnienie |  |
| `logDose` | zapis | właściciel / udostępnienie |  |
| `unlogDose` | zapis | właściciel / udostępnienie |  |
| `updateMedicationSchedule` | zapis | właściciel / udostępnienie |  |

## menuPrefs

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `getMenuPrefs` | odczyt | tylko własne konto |  |
| `updateMenuPrefs` | zapis | tylko własne konto |  |

## metrics

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `getUnitEconomics` | odczyt | administrator |  |

## news

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `acknowledgeItem` | zapis | właściciel / udostępnienie |  |
| `createSource` | zapis | właściciel / udostępnienie |  |
| `createTopic` | zapis | właściciel / udostępnienie |  |
| `deleteSource` | zapis | właściciel / udostępnienie |  |
| `deleteTopic` | zapis | właściciel / udostępnienie |  |
| `dismissItem` | zapis | właściciel / udostępnienie |  |
| `getHotTopics` | odczyt | właściciel / udostępnienie |  |
| `getKnowledgeHistory` | odczyt | właściciel / udostępnienie |  |
| `getNewsPref` | odczyt | tylko własne konto |  |
| `getSources` | odczyt | właściciel / udostępnienie |  |
| `getTopics` | odczyt | właściciel / udostępnienie |  |
| `getTopicView` | odczyt | właściciel / udostępnienie |  |
| `refreshTopic` | zapis | właściciel / udostępnienie |  |
| `resummarizeItem` | zapis | właściciel / udostępnienie |  |
| `setActiveSource` | zapis | administrator |  |
| `setDefaultSummaryLength` | zapis | administrator |  |
| `updateSource` | zapis | właściciel / udostępnienie |  |
| `updateTopic` | zapis | właściciel / udostępnienie |  |

## noteGroups

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `createNoteGroup` | zapis | właściciel / udostępnienie |  |
| `deleteNoteGroup` | zapis | właściciel / udostępnienie |  |
| `getNoteGroups` | odczyt | właściciel / udostępnienie |  |
| `updateNoteGroup` | zapis | właściciel / udostępnienie |  |

## notes

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `addNoteAttachment` | zapis | właściciel / udostępnienie |  |
| `addTagToNote` | zapis | właściciel / udostępnienie |  |
| `createNote` | zapis | właściciel / udostępnienie |  |
| `deleteNote` | zapis | właściciel / udostępnienie |  |
| `deleteNoteAttachment` | zapis | właściciel / udostępnienie |  |
| `getNoteAttachments` | odczyt | właściciel / udostępnienie |  |
| `getNoteRevisions` | odczyt | właściciel / udostępnienie |  |
| `getNotes` | odczyt | właściciel / udostępnienie |  |
| `removeTagFromNote` | zapis | właściciel / udostępnienie |  |
| `restoreNoteRevision` | zapis | właściciel / udostępnienie |  |
| `setNoteTags` | zapis | właściciel / udostępnienie |  |
| `toggleNotePin` | zapis | właściciel / udostępnienie |  |
| `updateNote` | zapis | właściciel / udostępnienie |  |

## notifications

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `getNotifications` | odczyt | tylko własne konto |  |
| `getUnreadCount` | odczyt | tylko własne konto |  |
| `markAllNotificationsRead` | zapis | tylko własne konto |  |
| `markNotificationRead` | zapis | tylko własne konto |  |
| `syncReminders` | zapis | tylko własne konto |  |

## pantry

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `addPantryItem` | zapis | właściciel / udostępnienie |  |
| `autoReplenishToList` | zapis | właściciel / udostępnienie |  |
| `bulkSetPantryQuantities` | zapis | właściciel / udostępnienie |  |
| `consumePantryItem` | zapis | właściciel / udostępnienie |  |
| `deletePantryItem` | zapis | właściciel / udostępnienie |  |
| `getAutoReplenishCandidates` | odczyt | właściciel / udostępnienie |  |
| `getExpiringSoon` | odczyt | właściciel / udostępnienie |  |
| `getPantry` | odczyt | właściciel / udostępnienie |  |
| `moveItemToPantry` | zapis | właściciel / udostępnienie |  |
| `setPantryQuantity` | zapis | właściciel / udostępnienie |  |
| `updatePantryItem` | zapis | właściciel / udostępnienie |  |

## petBreeding

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `createBreedingPair` | zapis | właściciel / udostępnienie |  |
| `createClutch` | zapis | właściciel / udostępnienie |  |
| `createOffspring` | zapis | właściciel / udostępnienie |  |
| `deleteBreedingPair` | zapis | właściciel / udostępnienie |  |
| `deleteClutch` | zapis | właściciel / udostępnienie |  |
| `deleteSale` | zapis | właściciel / udostępnienie |  |
| `getPetBreeding` | odczyt | właściciel / udostępnienie |  |
| `markClutchHatched` | zapis | właściciel / udostępnienie |  |
| `recordSale` | zapis | właściciel / udostępnienie |  |
| `setGenetics` | zapis | właściciel / udostępnienie |  |
| `setParentage` | zapis | właściciel / udostępnienie |  |
| `updateBreedingPair` | zapis | właściciel / udostępnienie |  |

## petCare

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `addMeasurement` | zapis | właściciel / udostępnienie |  |
| `completeCareTask` | zapis | właściciel / udostępnienie |  |
| `completeTreatment` | zapis | właściciel / udostępnienie |  |
| `createCareTask` | zapis | właściciel / udostępnienie |  |
| `createHealthRecord` | zapis | właściciel / udostępnienie |  |
| `createTreatment` | zapis | właściciel / udostępnienie |  |
| `createVetVisit` | zapis | właściciel / udostępnienie |  |
| `deleteCareTask` | zapis | właściciel / udostępnienie |  |
| `deleteHealthRecord` | zapis | właściciel / udostępnienie |  |
| `deleteMeasurement` | zapis | właściciel / udostępnienie |  |
| `deleteTreatment` | zapis | właściciel / udostępnienie |  |
| `deleteVetVisit` | zapis | właściciel / udostępnienie |  |
| `getCareAgenda` | odczyt | właściciel / udostępnienie |  |
| `getCareHistory` | odczyt | właściciel / udostępnienie |  |
| `getPetWelfare` | odczyt | właściciel / udostępnienie |  |
| `logFeeding` | zapis | właściciel / udostępnienie |  |
| `updateCareTask` | zapis | właściciel / udostępnienie |  |
| `updateHealthRecord` | zapis | właściciel / udostępnienie |  |
| `updateTreatment` | zapis | właściciel / udostępnienie |  |
| `updateVetVisit` | zapis | właściciel / udostępnienie |  |

## petHusbandry

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `addEnvironmentReading` | zapis | właściciel / udostępnienie |  |
| `assignPetToEnclosure` | zapis | właściciel / udostępnienie |  |
| `createEnclosure` | zapis | właściciel / udostępnienie |  |
| `deleteEnclosure` | zapis | właściciel / udostępnienie |  |
| `deleteEnvironmentReading` | zapis | właściciel / udostępnienie |  |
| `getEnclosures` | odczyt | właściciel / udostępnienie |  |
| `updateEnclosure` | zapis | właściciel / udostępnienie |  |

## pets

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `createPet` | zapis | właściciel / udostępnienie |  |
| `deletePet` | zapis | właściciel / udostępnienie |  |
| `getPet` | odczyt | właściciel / udostępnienie |  |
| `getPets` | odczyt | właściciel / udostępnienie |  |
| `getPetSharing` | odczyt | właściciel / udostępnienie |  |
| `removePetShare` | zapis | właściciel / udostępnienie |  |
| `setPetStatus` | zapis | właściciel / udostępnienie |  |
| `sharePetByEmail` | zapis | właściciel / udostępnienie |  |
| `sharePetWithTeam` | zapis | właściciel / udostępnienie |  |
| `updatePet` | zapis | właściciel / udostępnienie |  |
| `updatePetFeatures` | zapis | właściciel / udostępnienie |  |

## portfel

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `addEntry` | zapis | właściciel / udostępnienie |  |
| `archiveElement` | zapis | właściciel / udostępnienie |  |
| `createElement` | zapis | właściciel / udostępnienie |  |
| `deleteElement` | zapis | właściciel / udostępnienie |  |
| `getElement` | odczyt | właściciel / udostępnienie |  |
| `getWalletElements` | odczyt | właściciel / udostępnienie |  |
| `getWalletOverview` | odczyt | właściciel / udostępnienie |  |
| `importBankCsv` | zapis | właściciel / udostępnienie |  |
| `setBalance` | zapis | właściciel / udostępnienie |  |
| `updateElement` | zapis | właściciel / udostępnienie |  |

## portfelAuto

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `getFinanceSettings` | odczyt | tylko własne konto |  |
| `setFinanceSettings` | zapis | tylko własne konto |  |

## portfelBudgets

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `contributeGoal` | zapis | właściciel / udostępnienie |  |
| `createBudget` | zapis | właściciel / udostępnienie |  |
| `createGoal` | zapis | właściciel / udostępnienie |  |
| `deleteBudget` | zapis | właściciel / udostępnienie |  |
| `deleteGoal` | zapis | właściciel / udostępnienie |  |
| `getBudgetsWithSpending` | odczyt | właściciel / udostępnienie |  |
| `getFinanceGoals` | odczyt | właściciel / udostępnienie |  |
| `updateBudget` | zapis | właściciel / udostępnienie |  |
| `updateGoal` | zapis | właściciel / udostępnienie |  |

## portfelCurrency

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `deleteExchangeRate` | zapis | tylko własne konto |  |
| `getCurrencySettings` | odczyt | tylko własne konto |  |
| `refreshRatesFromNBP` | zapis | tylko własne konto |  |
| `setBaseCurrency` | zapis | tylko własne konto |  |
| `setExchangeRate` | zapis | tylko własne konto |  |

## portfelReports

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `getMonthlyReport` | odczyt | właściciel / udostępnienie |  |

## privacy

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `deleteMyAccount` | zapis | tylko własne konto |  |
| `exportMyData` | zapis | tylko własne konto |  |

## products

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `copyGlobalProduct` | zapis | właściciel / udostępnienie |  |
| `createProduct` | zapis | właściciel / udostępnienie |  |
| `deleteProduct` | zapis | właściciel / udostępnienie |  |
| `getProducts` | odczyt | wspólny słownik (wymaga zalogowania) |  |
| `getProductSuggestions` | odczyt | właściciel / udostępnienie |  |
| `updateProduct` | zapis | właściciel / udostępnienie |  |
| `upsertUserProduct` | zapis | właściciel / udostępnienie |  |

## projectGroups

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `createProjectGroup` | zapis | właściciel / udostępnienie |  |
| `deleteProjectGroup` | zapis | właściciel / udostępnienie |  |
| `getProjectGroup` | odczyt | właściciel / udostępnienie |  |
| `getProjectGroups` | odczyt | właściciel / udostępnienie |  |
| `updateProjectGroup` | zapis | właściciel / udostępnienie |  |

## qa

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `createEpic` | zapis | administrator |  |
| `createScenario` | zapis | administrator |  |
| `createStory` | zapis | administrator |  |
| `deleteEpic` | zapis | administrator |  |
| `deleteScenario` | zapis | administrator |  |
| `deleteStory` | zapis | administrator |  |
| `getAllEpics` | odczyt | administrator |  |
| `getEpicForAdmin` | odczyt | administrator |  |
| `getModuleStats` | odczyt | administrator |  |
| `getModuleTree` | odczyt | administrator |  |
| `getScenarioForAdmin` | odczyt | administrator |  |
| `getScenarioWithContext` | odczyt | administrator |  |
| `getStoryForAdmin` | odczyt | administrator |  |
| `updateEpic` | zapis | administrator |  |
| `updateScenario` | zapis | administrator |  |
| `updateStory` | zapis | administrator |  |

## recipes

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `addIngredient` | zapis | właściciel / udostępnienie |  |
| `addRecipeImage` | zapis | właściciel / udostępnienie |  |
| `addStep` | zapis | właściciel / udostępnienie |  |
| `archiveRecipe` | zapis | właściciel / udostępnienie |  |
| `createRecipe` | zapis | właściciel / udostępnienie |  |
| `deleteIngredient` | zapis | właściciel / udostępnienie |  |
| `deleteRecipe` | zapis | właściciel / udostępnienie |  |
| `deleteRecipeImage` | zapis | właściciel / udostępnienie |  |
| `deleteStep` | zapis | właściciel / udostępnienie |  |
| `duplicateRecipe` | zapis | właściciel / udostępnienie |  |
| `getRecipe` | odczyt | właściciel / udostępnienie |  |
| `getRecipes` | odczyt | właściciel / udostępnienie |  |
| `markRecipeCooked` | zapis | właściciel / udostępnienie |  |
| `reorderIngredients` | zapis | właściciel / udostępnienie |  |
| `reorderSteps` | zapis | właściciel / udostępnienie |  |
| `shopForRecipe` | zapis | właściciel / udostępnienie |  |
| `updateIngredient` | zapis | właściciel / udostępnienie |  |
| `updateRecipe` | zapis | właściciel / udostępnienie |  |
| `updateRecipeImage` | zapis | właściciel / udostępnienie |  |
| `updateStep` | zapis | właściciel / udostępnienie |  |

## reports

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `createReport` | zapis | administrator |  |
| `createUserReport` | zapis | właściciel / udostępnienie |  |
| `deleteReport` | zapis | administrator |  |
| `getReport` | odczyt | właściciel / udostępnienie |  |
| `getReportsMeta` | odczyt | właściciel / udostępnienie |  |
| `getUserReport` | odczyt | właściciel / udostępnienie |  |
| `getUserReportsMeta` | odczyt | właściciel / udostępnienie |  |
| `searchReports` | odczyt | właściciel / udostępnienie |  |
| `updateReport` | zapis | administrator |  |

## shoppingSync

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `syncShoppingMutations` | zapis | tylko własne konto |  |

## skins

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `createSkin` | zapis | administrator |  |
| `deleteSkin` | zapis | administrator |  |
| `duplicateSkin` | zapis | administrator |  |
| `getActiveSkinId` | odczyt | tylko własne konto |  |
| `listAvailableSkins` | odczyt | tylko własne konto |  |
| `setActiveSkin` | zapis | administrator |  |
| `updateSkin` | zapis | administrator |  |

## storage

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `addBatch` | zapis | właściciel / udostępnienie |  |
| `addLowStockToShoppingList` | zapis | właściciel / udostępnienie |  |
| `addStorageItem` | zapis | właściciel / udostępnienie |  |
| `addSupplier` | zapis | właściciel / udostępnienie |  |
| `adjustStorageQuantity` | zapis | właściciel / udostępnienie |  |
| `bulkAddStorageItems` | zapis | właściciel / udostępnienie |  |
| `bulkSetStorageQuantities` | zapis | właściciel / udostępnienie |  |
| `createDocument` | zapis | właściciel / udostępnienie |  |
| `createPurchaseOrder` | zapis | właściciel / udostępnienie |  |
| `deleteBatch` | zapis | właściciel / udostępnienie |  |
| `deleteDocument` | zapis | właściciel / udostępnienie |  |
| `deletePurchaseOrder` | zapis | właściciel / udostępnienie |  |
| `deleteStorageItem` | zapis | właściciel / udostępnienie |  |
| `deleteSupplier` | zapis | właściciel / udostępnienie |  |
| `getDocument` | odczyt | właściciel / udostępnienie |  |
| `getDocuments` | odczyt | właściciel / udostępnienie |  |
| `getExpiringStorage` | odczyt | właściciel / udostępnienie |  |
| `getLowStock` | odczyt | właściciel / udostępnienie |  |
| `getPurchaseOrder` | odczyt | właściciel / udostępnienie |  |
| `getPurchaseOrders` | odczyt | właściciel / udostępnienie |  |
| `getStorageAnalytics` | odczyt | właściciel / udostępnienie |  |
| `getStorageItem` | odczyt | właściciel / udostępnienie |  |
| `getStorageItems` | odczyt | właściciel / udostępnienie |  |
| `getStorageSettings` | odczyt | tylko własne konto |  |
| `getSuppliers` | odczyt | właściciel / udostępnienie |  |
| `setStorageCurrency` | zapis | administrator |  |
| `setStorageMode` | zapis | administrator |  |
| `transferStock` | zapis | właściciel / udostępnienie |  |
| `updatePurchaseOrder` | zapis | właściciel / udostępnienie |  |
| `updateStorageItem` | zapis | właściciel / udostępnienie |  |
| `updateSupplier` | zapis | właściciel / udostępnienie |  |

## stores

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `createStore` | zapis | właściciel / udostępnienie |  |
| `deleteStore` | zapis | właściciel / udostępnienie |  |
| `deleteStoreEdge` | zapis | właściciel / udostępnienie |  |
| `deleteStoreNode` | zapis | właściciel / udostępnienie |  |
| `getStore` | odczyt | właściciel / udostępnienie |  |
| `getStores` | odczyt | właściciel / udostępnienie |  |
| `renameStore` | zapis | właściciel / udostępnienie |  |
| `saveStoreGraph` | zapis | właściciel / udostępnienie |  |
| `upsertStoreEdge` | zapis | właściciel / udostępnienie |  |
| `upsertStoreNode` | zapis | właściciel / udostępnienie |  |

## systemHealth

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `getSystemHealth` | odczyt | administrator |  |

## tags

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `createTag` | zapis | właściciel / udostępnienie |  |
| `deleteTag` | zapis | właściciel / udostępnienie |  |
| `getTags` | odczyt | właściciel / udostępnienie |  |
| `updateTag` | zapis | właściciel / udostępnienie |  |

## taskProjects

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `addProjectMember` | zapis | właściciel / udostępnienie |  |
| `createTaskProject` | zapis | właściciel / udostępnienie |  |
| `deleteTaskProject` | zapis | właściciel / udostępnienie |  |
| `getTaskProjects` | odczyt | właściciel / udostępnienie |  |
| `removeProjectMember` | zapis | właściciel / udostępnienie |  |
| `updateTaskProject` | zapis | właściciel / udostępnienie |  |
| `updateTaskProjectStatusConfig` | zapis | tylko własne konto |  |

## taskTags

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `createTaskTag` | zapis | właściciel / udostępnienie |  |
| `deleteTaskTag` | zapis | właściciel / udostępnienie |  |
| `getTaskTags` | odczyt | właściciel / udostępnienie |  |
| `updateTaskTag` | zapis | właściciel / udostępnienie |  |

## tasks

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `addTaskComment` | zapis | właściciel / udostępnienie |  |
| `bulkDeleteTasks` | zapis | właściciel / udostępnienie |  |
| `bulkUpdateTasks` | zapis | właściciel / udostępnienie |  |
| `completeRecurringTask` | zapis | wyłącznie serwerowo |  |
| `createTask` | zapis | właściciel / udostępnienie |  |
| `deleteTask` | zapis | właściciel / udostępnienie |  |
| `deleteTaskComment` | zapis | właściciel / udostępnienie |  |
| `getAllUserTasks` | odczyt | właściciel / udostępnienie |  |
| `getOverdueTasks` | odczyt | właściciel / udostępnienie |  |
| `getTask` | odczyt | właściciel / udostępnienie |  |
| `getTasks` | odczyt | właściciel / udostępnienie |  |
| `getTasksForProjects` | odczyt | właściciel / udostępnienie |  |
| `getTodayTasks` | odczyt | właściciel / udostępnienie |  |
| `removeTaskShare` | zapis | właściciel / udostępnienie |  |
| `reorderTask` | zapis | właściciel / udostępnienie |  |
| `shareTask` | zapis | właściciel / udostępnienie |  |
| `shareTaskByEmail` | zapis | właściciel / udostępnienie |  |
| `toggleTaskStatus` | zapis | właściciel / udostępnienie |  |
| `updateTask` | zapis | właściciel / udostępnienie |  |
| `updateTaskTags` | zapis | właściciel / udostępnienie |  |

## teams

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `changeMemberRole` | zapis | właściciel / udostępnienie |  |
| `createSubTeam` | zapis | właściciel / udostępnienie |  |
| `createTeam` | zapis | właściciel / udostępnienie |  |
| `deleteTeam` | zapis | właściciel / udostępnienie |  |
| `getHouseholdOnboarding` | odczyt | właściciel / udostępnienie |  |
| `getMyTeams` | odczyt | właściciel / udostępnienie |  |
| `getTeam` | odczyt | właściciel / udostępnienie |  |
| `leaveTeam` | zapis | właściciel / udostępnienie |  |
| `removeMember` | zapis | właściciel / udostępnienie |  |
| `setMemberModuleAccess` | zapis | właściciel / udostępnienie |  |
| `transferTeamOwnership` | zapis | właściciel / udostępnienie |  |
| `updateTeam` | zapis | właściciel / udostępnienie |  |

## trash

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `emptyTrash` | zapis | właściciel / udostępnienie |  |
| `getTrash` | odczyt | właściciel / udostępnienie |  |
| `purgeTrashItem` | zapis | właściciel / udostępnienie |  |
| `restoreTrashItem` | zapis | właściciel / udostępnienie |  |

## truck

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `getVehicleProfile` | odczyt | właściciel / udostępnienie |  |
| `planTruckRoute` | zapis | właściciel / udostępnienie |  |
| `saveVehicleProfile` | zapis | właściciel / udostępnienie |  |

## units

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `createUnit` | zapis | właściciel / udostępnienie |  |
| `deleteUnit` | zapis | właściciel / udostępnienie |  |
| `getUnits` | odczyt | wspólny słownik (wymaga zalogowania) |  |
| `getUnitSuggestions` | odczyt | właściciel / udostępnienie |  |
| `renameUnit` | zapis | właściciel / udostępnienie |  |

## warsztat

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `addSuggestedItems` | zapis | właściciel / udostępnienie |  |
| `addWorkshopItem` | zapis | właściciel / udostępnienie |  |
| `addWorkshopProject` | zapis | właściciel / udostępnienie |  |
| `adjustWorkshopItemQuantity` | zapis | właściciel / udostępnienie |  |
| `createWorkshop` | zapis | właściciel / udostępnienie |  |
| `deleteWorkshop` | zapis | właściciel / udostępnienie |  |
| `deleteWorkshopItem` | zapis | właściciel / udostępnienie |  |
| `deleteWorkshopProject` | zapis | właściciel / udostępnienie |  |
| `getMaintenanceOverview` | odczyt | właściciel / udostępnienie |  |
| `getWarsztatSettings` | odczyt | tylko własne konto |  |
| `getWorkshop` | odczyt | właściciel / udostępnienie |  |
| `getWorkshops` | odczyt | właściciel / udostępnienie |  |
| `setWarsztatMode` | zapis | administrator |  |
| `updateWorkshop` | zapis | właściciel / udostępnienie |  |
| `updateWorkshopItem` | zapis | właściciel / udostępnienie |  |
| `updateWorkshopProject` | zapis | właściciel / udostępnienie |  |

## weather

| Akcja | Rodzaj | Zakres dostępu | Uwaga |
|---|---|---|---|
| `addCustomWatcher` | zapis | właściciel / udostępnienie |  |
| `addLocation` | zapis | właściciel / udostępnienie |  |
| `addLocationByName` | zapis | właściciel / udostępnienie |  |
| `addPresetWatcher` | zapis | właściciel / udostępnienie |  |
| `deleteLocation` | zapis | właściciel / udostępnienie |  |
| `deleteWatcher` | zapis | właściciel / udostępnienie |  |
| `getLocations` | odczyt | właściciel / udostępnienie |  |
| `getWatchers` | odczyt | właściciel / udostępnienie |  |
| `getWeather` | odczyt | właściciel / udostępnienie |  |
| `setDefaultLocation` | zapis | właściciel / udostępnienie |  |
| `updateWatcher` | zapis | właściciel / udostępnienie |  |

