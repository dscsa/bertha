function onOpen(e) {
  var ui = SpreadsheetApp.getUi()
  ui.createMenu('Email Functionality')
    .addItem('Send Donation Emails', 'send_emails_from_main_page')
    .addItem('Manually Generate Pickups Email (MUST highlight full row of Pickups sheet)', 'manually_generate_emails')
    .addItem('Generate Supply Emails', 'generate_supply_email_drafts')
    .addItem('Send Supply Emails', 'send_supply_emails')
    .addToUi();
  ui.createMenu('Auto-Group & Auto-Archive')
     .addItem('Group around last row name', 'manual_group')
     .addItem('Run Main Page Archiving', 'archive')
     .addItem('Run Supplies Email Page Archiving', 'archive_supply_emails')
     .addToUi();

}


