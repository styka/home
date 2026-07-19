# Pokrycie akcji użytkownika przez asystenta AI

> Plik generowany przez `scripts/check-ai-coverage.js --report`. Nie edytuj ręcznie.

Stan: **107 wystawionych (ai)**, **123 do zrobienia (pending)**, **113 świadomie wykluczonych (excluded)** — razem 343 mutujących akcji.

Legenda statusów: `ai` = asystent to potrafi · `pending` = luka do domknięcia · `excluded` = nie dla AI (admin/ustawienia/wewnętrzne/interaktywne).

## access — 0/6 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `addUserRole` | ⛔ excluded | admin |
| `createPermission` | ⛔ excluded | admin |
| `deletePermission` | ⛔ excluded | admin |
| `removeUserRole` | ⛔ excluded | admin |
| `toggleRolePermission` | ⛔ excluded | admin |
| `updatePermission` | ⛔ excluded | admin |

## activity — 0/1 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `trackActivity` | ⛔ excluded | internal |

## adminCategories — 0/3 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `createSystemCategory` | ⛔ excluded | admin |
| `deleteSystemCategory` | ⛔ excluded | admin |
| `updateSystemCategory` | ⛔ excluded | admin |

## aiConversations — 0/4 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `appendAiMessage` | ⛔ excluded | internal |
| `createAiConversation` | ⛔ excluded | internal |
| `deleteAiConversation` | ⛔ excluded | internal |
| `renameAiConversation` | ⛔ excluded | internal |

## calendar — 0/1 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `regenerateIcalFeed` | ⛔ excluded | settings |

## categories — 0/3 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `createCategory` | 🕓 pending |  |
| `deleteCategory` | 🕓 pending |  |
| `updateCategory` | 🕓 pending |  |

## categoryIcons — 0/8 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `assignIconToCategory` | ⛔ excluded | admin |
| `deactivateCategoryIcon` | ⛔ excluded | admin |
| `deleteCategoryIconVariant` | ⛔ excluded | admin |
| `orphanCategoryIcons` | ⛔ excluded | admin |
| `saveAndActivateCategoryIcon` | ⛔ excluded | admin |
| `saveToLibrary` | ⛔ excluded | admin |
| `setActiveCategoryIcon` | ⛔ excluded | admin |
| `upsertCategoryEmojiOverride` | ⛔ excluded | admin |

## config — 0/1 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `setConfigValue` | ⛔ excluded | admin |

## contacts — 3/3 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `createContact` | ✅ ai | → create_contact |
| `deleteContact` | ✅ ai | → delete_contact |
| `updateContact` | ✅ ai | → update_contact |

## cookbooks — 0/3 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `createCookbook` | 🕓 pending |  |
| `deleteCookbook` | 🕓 pending |  |
| `updateCookbook` | 🕓 pending |  |

## dashboardPrefs — 0/1 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `setDashboardPrefs` | ⛔ excluded | settings |

## drive — 0/1 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `disconnectDrive` | ⛔ excluded | settings |

## flota — 5/9 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `addFuelLog` | ✅ ai |  |
| `addServiceRecord` | ✅ ai |  |
| `addVehicleAttachment` | ⛔ excluded | interactive |
| `createVehicle` | ✅ ai |  |
| `deleteFuelLog` | 🕓 pending |  |
| `deleteServiceRecord` | 🕓 pending |  |
| `deleteVehicle` | ✅ ai |  |
| `deleteVehicleAttachment` | ⛔ excluded | interactive |
| `updateVehicle` | ✅ ai |  |

## habits — 5/7 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `createHabit` | ✅ ai |  |
| `createTaskFromHabit` | 🕓 pending |  |
| `deleteHabit` | ✅ ai |  |
| `reorderHabits` | ⛔ excluded | interactive |
| `setHabitArchived` | ✅ ai |  |
| `toggleHabitDay` | ✅ ai |  |
| `updateHabit` | ✅ ai |  |

## health — 4/7 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `addHealthAttachment` | ⛔ excluded | interactive |
| `createHealthEvent` | ✅ ai |  |
| `deleteHealthAttachment` | ⛔ excluded | interactive |
| `deleteHealthEvent` | ✅ ai |  |
| `setHealthAiOptIn` | ⛔ excluded | admin |
| `setHealthStatus` | ✅ ai |  |
| `updateHealthEvent` | ✅ ai |  |

## invitations — 0/3 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `acceptInvitation` | ⛔ excluded | teams |
| `inviteUser` | ⛔ excluded | teams |
| `rejectInvitation` | ⛔ excluded | teams |

## items — 7/9 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `addItem` | ✅ ai |  |
| `addItemStructured` | ⛔ excluded | interactive |
| `clearDoneItems` | ✅ ai |  |
| `deleteItem` | ✅ ai |  |
| `markAllInCart` | ✅ ai |  |
| `moveItem` | ✅ ai | → move_item |
| `reorderItems` | ⛔ excluded | interactive |
| `updateItem` | ✅ ai |  |
| `updateItemStatus` | ✅ ai |  |

## jobs — 0/3 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `cancelJobAction` | ⛔ excluded | admin |
| `cleanupJobsAction` | ⛔ excluded | admin |
| `retryJobAction` | ⛔ excluded | admin |

## languageDecks — 6/8 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `addWord` | ✅ ai |  |
| `bulkAddWords` | 🕓 pending |  |
| `createDeck` | ✅ ai |  |
| `deleteDeck` | ✅ ai |  |
| `deleteWord` | ✅ ai |  |
| `submitReview` | ⛔ excluded | interactive |
| `updateDeck` | ✅ ai |  |
| `updateWord` | ✅ ai |  |

## legal — 0/2 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `acceptAllCurrentConsents` | ⛔ excluded | account |
| `acceptConsent` | ⛔ excluded | account |

## lists — 6/6 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `archiveList` | ✅ ai |  |
| `completeShopping` | ✅ ai | → complete_shopping |
| `createList` | ✅ ai |  |
| `deleteList` | ✅ ai |  |
| `renameList` | ✅ ai |  |
| `unarchiveList` | ✅ ai | → unarchive_list |

## llmConfig — 0/6 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `applyAnthropicProfile` | ⛔ excluded | admin |
| `createProvider` | ⛔ excluded | admin |
| `deleteProvider` | ⛔ excluded | admin |
| `setAssignment` | ⛔ excluded | admin |
| `setCostAlertThreshold` | ⛔ excluded | admin |
| `updateProvider` | ⛔ excluded | admin |

## mealPlans — 4/8 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `bulkSetMealPlan` | 🕓 pending |  |
| `deleteMealPlanEntry` | ✅ ai |  |
| `generateShoppingListFromPlan` | ✅ ai | → generate_shopping_from_plan |
| `markMealCooked` | ✅ ai |  |
| `markMealSkipped` | 🕓 pending |  |
| `moveMealPlanEntry` | 🕓 pending |  |
| `setMealPlanEntry` | ✅ ai |  |
| `updateMealPlanEntry` | 🕓 pending |  |

## medications — 3/5 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `createMedicationSchedule` | ✅ ai |  |
| `deleteMedicationSchedule` | ✅ ai |  |
| `logDose` | ✅ ai |  |
| `unlogDose` | 🕓 pending |  |
| `updateMedicationSchedule` | 🕓 pending |  |

## menuPrefs — 0/1 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `updateMenuPrefs` | ⛔ excluded | settings |

## news — 4/12 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `acknowledgeItem` | 🕓 pending |  |
| `createSource` | 🕓 pending |  |
| `createTopic` | ✅ ai |  |
| `deleteSource` | 🕓 pending |  |
| `deleteTopic` | ✅ ai |  |
| `dismissItem` | 🕓 pending |  |
| `refreshTopic` | ✅ ai |  |
| `resummarizeItem` | 🕓 pending |  |
| `setActiveSource` | ⛔ excluded | admin |
| `setDefaultSummaryLength` | ⛔ excluded | admin |
| `updateSource` | 🕓 pending |  |
| `updateTopic` | ✅ ai |  |

## noteGroups — 0/3 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `createNoteGroup` | 🕓 pending |  |
| `deleteNoteGroup` | 🕓 pending |  |
| `updateNoteGroup` | 🕓 pending |  |

## notes — 5/10 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `addNoteAttachment` | ⛔ excluded | interactive |
| `addTagToNote` | 🕓 pending |  |
| `createNote` | ✅ ai |  |
| `deleteNote` | ✅ ai |  |
| `deleteNoteAttachment` | ⛔ excluded | interactive |
| `removeTagFromNote` | 🕓 pending |  |
| `restoreNoteRevision` | ⛔ excluded | interactive |
| `setNoteTags` | ✅ ai | → set_note_tags |
| `toggleNotePin` | ✅ ai |  |
| `updateNote` | ✅ ai |  |

## notifications — 1/4 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `markAllNotificationsRead` | ⛔ excluded | internal |
| `markNotificationRead` | ⛔ excluded | internal |
| `notifyUser` | ✅ ai |  |
| `syncReminders` | ⛔ excluded | internal |

## pantry — 4/8 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `addPantryItem` | ✅ ai |  |
| `autoReplenishToList` | 🕓 pending |  |
| `bulkSetPantryQuantities` | ⛔ excluded | interactive |
| `consumePantryItem` | ✅ ai |  |
| `deletePantryItem` | ✅ ai |  |
| `moveItemToPantry` | 🕓 pending |  |
| `setPantryQuantity` | 🕓 pending |  |
| `updatePantryItem` | ✅ ai |  |

## petBreeding — 5/11 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `createBreedingPair` | ✅ ai |  |
| `createClutch` | ✅ ai |  |
| `createOffspring` | ✅ ai |  |
| `deleteBreedingPair` | 🕓 pending |  |
| `deleteClutch` | 🕓 pending |  |
| `deleteSale` | 🕓 pending |  |
| `markClutchHatched` | ✅ ai |  |
| `recordSale` | ✅ ai |  |
| `setGenetics` | 🕓 pending |  |
| `setParentage` | 🕓 pending |  |
| `updateBreedingPair` | 🕓 pending |  |

## petCare — 8/17 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `addMeasurement` | ✅ ai |  |
| `completeCareTask` | ✅ ai |  |
| `completeTreatment` | ✅ ai |  |
| `createCareTask` | ✅ ai |  |
| `createHealthRecord` | ✅ ai |  |
| `createTreatment` | ✅ ai |  |
| `createVetVisit` | ✅ ai |  |
| `deleteCareTask` | 🕓 pending |  |
| `deleteHealthRecord` | 🕓 pending |  |
| `deleteMeasurement` | 🕓 pending |  |
| `deleteTreatment` | 🕓 pending |  |
| `deleteVetVisit` | 🕓 pending |  |
| `logFeeding` | ✅ ai |  |
| `updateCareTask` | 🕓 pending |  |
| `updateHealthRecord` | 🕓 pending |  |
| `updateTreatment` | 🕓 pending |  |
| `updateVetVisit` | 🕓 pending |  |

## petHusbandry — 2/6 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `addEnvironmentReading` | ✅ ai |  |
| `assignPetToEnclosure` | 🕓 pending |  |
| `createEnclosure` | ✅ ai |  |
| `deleteEnclosure` | 🕓 pending |  |
| `deleteEnvironmentReading` | 🕓 pending |  |
| `updateEnclosure` | 🕓 pending |  |

## pets — 4/8 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `createPet` | ✅ ai |  |
| `deletePet` | ✅ ai |  |
| `removePetShare` | 🕓 pending |  |
| `setPetStatus` | ✅ ai |  |
| `sharePetByEmail` | 🕓 pending |  |
| `sharePetWithTeam` | 🕓 pending |  |
| `updatePet` | ✅ ai |  |
| `updatePetFeatures` | 🕓 pending |  |

## portfel — 6/7 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `addEntry` | ✅ ai |  |
| `archiveElement` | ✅ ai |  |
| `createElement` | ✅ ai |  |
| `deleteElement` | ✅ ai |  |
| `importBankCsv` | ⛔ excluded | interactive |
| `setBalance` | ✅ ai |  |
| `updateElement` | ✅ ai |  |

## portfelAuto — 0/1 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `setFinanceSettings` | ⛔ excluded | settings |

## portfelBudgets — 3/7 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `contributeGoal` | ✅ ai | → contribute_goal |
| `createBudget` | ✅ ai | → create_budget |
| `createGoal` | ✅ ai | → create_goal |
| `deleteBudget` | 🕓 pending |  |
| `deleteGoal` | 🕓 pending |  |
| `updateBudget` | 🕓 pending |  |
| `updateGoal` | 🕓 pending |  |

## portfelCurrency — 0/4 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `deleteExchangeRate` | ⛔ excluded | settings |
| `refreshRatesFromNBP` | ⛔ excluded | settings |
| `setBaseCurrency` | ⛔ excluded | settings |
| `setExchangeRate` | ⛔ excluded | settings |

## privacy — 0/2 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `deleteMyAccount` | ⛔ excluded | account |
| `exportMyData` | ⛔ excluded | account |

## products — 0/5 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `copyGlobalProduct` | 🕓 pending |  |
| `createProduct` | 🕓 pending |  |
| `deleteProduct` | 🕓 pending |  |
| `updateProduct` | 🕓 pending |  |
| `upsertUserProduct` | 🕓 pending |  |

## projectGroups — 0/3 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `createProjectGroup` | 🕓 pending |  |
| `deleteProjectGroup` | 🕓 pending |  |
| `updateProjectGroup` | 🕓 pending |  |

## qa — 0/9 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `createEpic` | ⛔ excluded | admin |
| `createScenario` | ⛔ excluded | admin |
| `createStory` | ⛔ excluded | admin |
| `deleteEpic` | ⛔ excluded | admin |
| `deleteScenario` | ⛔ excluded | admin |
| `deleteStory` | ⛔ excluded | admin |
| `updateEpic` | ⛔ excluded | admin |
| `updateScenario` | ⛔ excluded | admin |
| `updateStory` | ⛔ excluded | admin |

## recipes — 2/18 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `addIngredient` | 🕓 pending |  |
| `addRecipeImage` | ⛔ excluded | interactive |
| `addStep` | 🕓 pending |  |
| `archiveRecipe` | 🕓 pending |  |
| `createRecipe` | ✅ ai |  |
| `deleteIngredient` | 🕓 pending |  |
| `deleteRecipe` | ✅ ai |  |
| `deleteRecipeImage` | ⛔ excluded | interactive |
| `deleteStep` | 🕓 pending |  |
| `duplicateRecipe` | 🕓 pending |  |
| `markRecipeCooked` | 🕓 pending |  |
| `reorderIngredients` | ⛔ excluded | interactive |
| `reorderSteps` | ⛔ excluded | interactive |
| `shopForRecipe` | 🕓 pending |  |
| `updateIngredient` | 🕓 pending |  |
| `updateRecipe` | 🕓 pending |  |
| `updateRecipeImage` | ⛔ excluded | interactive |
| `updateStep` | 🕓 pending |  |

## reports — 1/4 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `createReport` | ⛔ excluded | admin |
| `createUserReport` | ✅ ai |  |
| `deleteReport` | ⛔ excluded | admin |
| `updateReport` | ⛔ excluded | admin |

## shoppingSync — 0/1 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `syncShoppingMutations` | ⛔ excluded | internal |

## skins — 0/5 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `createSkin` | ⛔ excluded | admin |
| `deleteSkin` | ⛔ excluded | admin |
| `duplicateSkin` | ⛔ excluded | admin |
| `setActiveSkin` | ⛔ excluded | admin |
| `updateSkin` | ⛔ excluded | admin |

## storage — 5/20 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `addBatch` | 🕓 pending |  |
| `addLowStockToShoppingList` | 🕓 pending |  |
| `addStorageItem` | ✅ ai |  |
| `addSupplier` | 🕓 pending |  |
| `adjustStorageQuantity` | ✅ ai |  |
| `bulkAddStorageItems` | ⛔ excluded | interactive |
| `bulkSetStorageQuantities` | ⛔ excluded | interactive |
| `createDocument` | 🕓 pending |  |
| `createPurchaseOrder` | 🕓 pending |  |
| `deleteBatch` | 🕓 pending |  |
| `deleteDocument` | 🕓 pending |  |
| `deletePurchaseOrder` | 🕓 pending |  |
| `deleteStorageItem` | ✅ ai |  |
| `deleteSupplier` | 🕓 pending |  |
| `setStorageCurrency` | ⛔ excluded | admin |
| `setStorageMode` | ⛔ excluded | admin |
| `transferStock` | ✅ ai |  |
| `updatePurchaseOrder` | 🕓 pending |  |
| `updateStorageItem` | ✅ ai |  |
| `updateSupplier` | 🕓 pending |  |

## stores — 0/8 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `createStore` | ⛔ excluded | interactive |
| `deleteStore` | ⛔ excluded | interactive |
| `deleteStoreEdge` | ⛔ excluded | interactive |
| `deleteStoreNode` | ⛔ excluded | interactive |
| `renameStore` | ⛔ excluded | interactive |
| `saveStoreGraph` | ⛔ excluded | interactive |
| `upsertStoreEdge` | ⛔ excluded | interactive |
| `upsertStoreNode` | ⛔ excluded | interactive |

## tags — 0/3 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `createTag` | 🕓 pending |  |
| `deleteTag` | 🕓 pending |  |
| `updateTag` | 🕓 pending |  |

## taskProjects — 3/6 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `addProjectMember` | 🕓 pending |  |
| `createTaskProject` | ✅ ai |  |
| `deleteTaskProject` | ✅ ai |  |
| `removeProjectMember` | 🕓 pending |  |
| `updateTaskProject` | ✅ ai |  |
| `updateTaskProjectStatusConfig` | 🕓 pending |  |

## taskTags — 0/3 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `createTaskTag` | 🕓 pending |  |
| `deleteTaskTag` | 🕓 pending |  |
| `updateTaskTag` | 🕓 pending |  |

## tasks — 4/12 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `addTaskComment` | 🕓 pending |  |
| `completeRecurringTask` | 🕓 pending |  |
| `createTask` | ✅ ai |  |
| `deleteTask` | ✅ ai |  |
| `deleteTaskComment` | 🕓 pending |  |
| `removeTaskShare` | 🕓 pending |  |
| `reorderTask` | ⛔ excluded | interactive |
| `shareTask` | 🕓 pending |  |
| `shareTaskByEmail` | 🕓 pending |  |
| `toggleTaskStatus` | 🕓 pending |  |
| `updateTask` | ✅ ai |  |
| `updateTaskTags` | ✅ ai | → set_task_tags |

## teams — 0/9 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `changeMemberRole` | ⛔ excluded | teams |
| `createSubTeam` | ⛔ excluded | teams |
| `createTeam` | ⛔ excluded | teams |
| `deleteTeam` | ⛔ excluded | teams |
| `leaveTeam` | ⛔ excluded | teams |
| `removeMember` | ⛔ excluded | teams |
| `setMemberModuleAccess` | ⛔ excluded | teams |
| `transferTeamOwnership` | ⛔ excluded | teams |
| `updateTeam` | ⛔ excluded | teams |

## trash — 0/3 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `emptyTrash` | 🕓 pending |  |
| `purgeTrashItem` | 🕓 pending |  |
| `restoreTrashItem` | 🕓 pending |  |

## truck — 0/2 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `planTruckRoute` | 🕓 pending |  |
| `saveVehicleProfile` | 🕓 pending |  |

## units — 0/3 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `createUnit` | 🕓 pending |  |
| `deleteUnit` | 🕓 pending |  |
| `renameUnit` | 🕓 pending |  |

## warsztat — 2/12 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `addSuggestedItems` | 🕓 pending |  |
| `addWorkshopItem` | ✅ ai |  |
| `addWorkshopProject` | 🕓 pending |  |
| `adjustWorkshopItemQuantity` | 🕓 pending |  |
| `createWorkshop` | ✅ ai |  |
| `deleteWorkshop` | 🕓 pending |  |
| `deleteWorkshopItem` | 🕓 pending |  |
| `deleteWorkshopProject` | 🕓 pending |  |
| `setWarsztatMode` | ⛔ excluded | admin |
| `updateWorkshop` | 🕓 pending |  |
| `updateWorkshopItem` | 🕓 pending |  |
| `updateWorkshopProject` | 🕓 pending |  |

## weather — 5/8 wystawionych

| Akcja | Status | Uwaga |
|---|---|---|
| `addCustomWatcher` | 🕓 pending |  |
| `addLocation` | 🕓 pending |  |
| `addLocationByName` | ✅ ai |  |
| `addPresetWatcher` | ✅ ai |  |
| `deleteLocation` | ✅ ai |  |
| `deleteWatcher` | ✅ ai |  |
| `setDefaultLocation` | ✅ ai |  |
| `updateWatcher` | 🕓 pending |  |

