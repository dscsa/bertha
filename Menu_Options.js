function onOpen(e) {
  var ui = SpreadsheetApp.getUi()
  ui.createMenu('Email Functionality')
    .addItem('Send Donation Emails', 'sendEmailsFromMainSheet')
    .addItem('Manually Generate Pickups Email (MUST highlight full row of Pickups sheet)', 'manuallyGenerateEmails')
    .addItem('Generate Supply Emails', 'generateSupplyEmailDrafts')
    .addItem('Send Supply Emails', 'sendSupplyEmails')
    .addToUi();
  ui.createMenu('Auto-Group & Auto-Archive')
     .addItem('Group around last row name', 'manualGroup')
     .addItem('Run Main Page Archiving', 'archive')
     .addItem('Run Supplies Email Page Archiving', 'archiveSupplyEmails')
     .addToUi();

}


