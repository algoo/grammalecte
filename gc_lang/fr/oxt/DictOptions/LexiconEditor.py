# Lexicon Editor
# by Olivier R.
# License: MPL 2

import unohelper
import uno
import json
import urllib.parse
import re
import os
import traceback
import platform

import helpers
import lxe_strings as ui
import grammalecte.graphspell as sc
import grammalecte.graphspell.dawg as dawg
import grammalecte.graphspell.ibdawg as ibdawg
import grammalecte.fr.conj as conj
import grammalecte.fr.conj_generator as conjgen

import SearchWords
import TagsInfo

from com.sun.star.task import XJobExecutor
from com.sun.star.awt import XActionListener
from com.sun.star.awt import XTopWindowListener
from com.sun.star.awt import XKeyListener

from com.sun.star.awt.MessageBoxButtons import BUTTONS_OK
# BUTTONS_OK, BUTTONS_OK_CANCEL, BUTTONS_YES_NO, BUTTONS_YES_NO_CANCEL, BUTTONS_RETRY_CANCEL, BUTTONS_ABORT_IGNORE_RETRY
# DEFAULT_BUTTON_OK, DEFAULT_BUTTON_CANCEL, DEFAULT_BUTTON_RETRY, DEFAULT_BUTTON_YES, DEFAULT_BUTTON_NO, DEFAULT_BUTTON_IGNORE
from com.sun.star.awt.MessageBoxType import INFOBOX, ERRORBOX # MESSAGEBOX, INFOBOX, WARNINGBOX, ERRORBOX, QUERYBOX

def MessageBox (xDocument, sMsg, sTitle, nBoxType=INFOBOX, nBoxButtons=BUTTONS_OK):
    xParentWin = xDocument.CurrentController.Frame.ContainerWindow
    ctx = uno.getComponentContext()
    xToolkit = ctx.ServiceManager.createInstanceWithContext("com.sun.star.awt.Toolkit", ctx)
    xMsgBox = xToolkit.createMessageBox(xParentWin, nBoxType, nBoxButtons, sTitle, sMsg)
    return xMsgBox.execute()


def _waitPointer (funcDecorated):
    def wrapper (*args, **kwargs):
        # self is the first parameter if the decorator is applied on a object
        self = args[0]
        # before
        xPointer = self.xSvMgr.createInstanceWithContext("com.sun.star.awt.Pointer", self.ctx)
        xPointer.setType(uno.getConstantByName("com.sun.star.awt.SystemPointer.WAIT"))
        xWindowPeer = self.xContainer.getPeer()
        xWindowPeer.setPointer(xPointer)
        for x in xWindowPeer.Windows:
            x.setPointer(xPointer)
        # processing
        result = funcDecorated(*args, **kwargs)
        # after
        xPointer.setType(uno.getConstantByName("com.sun.star.awt.SystemPointer.ARROW"))
        xWindowPeer.setPointer(xPointer)
        for x in xWindowPeer.Windows:
            x.setPointer(xPointer)
        self.xContainer.setVisible(True) # seems necessary to refresh the dialog box and text widgets (why?)
        # return
        return result
    return wrapper


class LexiconEditor (unohelper.Base, XActionListener, XTopWindowListener, XKeyListener, XJobExecutor):

    def __init__ (self, ctx):
        self.ctx = ctx
        self.xSvMgr = self.ctx.ServiceManager
        self.xDesktop = self.xSvMgr.createInstanceWithContext("com.sun.star.frame.Desktop", self.ctx)
        self.xDocument = self.xDesktop.getCurrentComponent()
        self.xContainer = None
        self.xDialog = None
        self.bClosed = False
        self.oPersonalDicJSON = None
        # data
        self.sLemma = ""
        self.lGeneratedFlex = []
        # options node
        self.xSettingNode = helpers.getConfigSetting("/org.openoffice.Lightproof_grammalecte/Other/", True)
        self.xOptionNode = self.xSettingNode.getByName("o_fr")

    def _addWidget (self, name, wtype, x, y, w, h, **kwargs):
        xWidget = self.xDialog.createInstance('com.sun.star.awt.UnoControl%sModel' % wtype)
        xWidget.Name = name
        xWidget.PositionX = x
        xWidget.PositionY = y
        xWidget.Width = w
        xWidget.Height = h
        for k, w in kwargs.items():
            setattr(xWidget, k, w)
        self.xDialog.insertByName(name, xWidget)
        return xWidget

    def _addGrid (self, name, x, y, w, h, columns, **kwargs):
        xGridModel = self.xDialog.createInstance('com.sun.star.awt.grid.UnoControlGridModel')
        xGridModel.Name = name
        xGridModel.PositionX = x
        xGridModel.PositionY = y
        xGridModel.Width = w
        xGridModel.Height = h
        xColumnModel = xGridModel.ColumnModel
        for e in columns:
            xCol = xColumnModel.createColumn()
            for k, w in e.items():
                setattr(xCol, k, w)
            xColumnModel.addColumn(xCol)
        for k, w in kwargs.items():
            setattr(xGridModel, k, w)
        self.xDialog.insertByName(name, xGridModel)
        return xGridModel

    def run (self, sLang, sWord=""):
        # ui lang
        ui.selectLang(sLang)
        self.sLang = sLang

        # dialog
        self.xDialog = self.xSvMgr.createInstanceWithContext('com.sun.star.awt.UnoControlDialogModel', self.ctx)
        self.xDialog.Width = 550
        self.xDialog.Height = 290
        self.xDialog.Title = ui.get('title')
        xWindowSize = helpers.getWindowSize()
        self.xDialog.PositionX = int((xWindowSize.Width / 2) - (self.xDialog.Width / 2))
        self.xDialog.PositionY = int((xWindowSize.Height / 2) - (self.xDialog.Height / 2))

        # fonts
        xFDTitle = uno.createUnoStruct("com.sun.star.awt.FontDescriptor")
        xFDTitle.Height = 9
        xFDTitle.Weight = uno.getConstantByName("com.sun.star.awt.FontWeight.BOLD")
        xFDTitle.Name = "Verdana"

        xFDSubTitle = uno.createUnoStruct("com.sun.star.awt.FontDescriptor")
        xFDSubTitle.Height = 8
        xFDSubTitle.Weight = uno.getConstantByName("com.sun.star.awt.FontWeight.BOLD")
        xFDSubTitle.Name = "Verdana"

        # widget
        nX1 = 5
        nX2 = 15

        nY0 = 5
        nY1 = nY0 + 13
        nY2 = nY1 + 25 # nom commun
        nY3 = nY2 + 95 # nom propre
        nY4 = nY3 + 45 # verbe
        nY5 = nY4 + 68 # adverbe
        nY6 = nY5 + 13 # autre

        nXB = nX1 + 175
        nXC = nXB + 165

        nHeight = 10

        #### Dictionary section
        self._addWidget("dictionary_section", 'FixedLine', nX1, nY0, 170, nHeight, Label = ui.get("dictionary_section"), FontDescriptor = xFDTitle, TextColor = 0x559999)
        self._addWidget("save_date_label", 'FixedText', nXB, nY0+2, 80, nHeight, Label = ui.get("save_date_label"), FontDescriptor = xFDSubTitle, TextColor = 0x559999)
        self._addWidget("num_of_entries_label2", 'FixedText', nXC, nY0+2, 65, nHeight, Label = ui.get("num_of_entries_label"), FontDescriptor = xFDSubTitle, TextColor = 0x559999)
        self.xDateDic = self._addWidget("save_date", 'FixedText', nXB+85, nY0+2, 75, nHeight, Label = ui.get("void"), FontDescriptor = xFDSubTitle)
        self.xNumDic = self._addWidget("num_of_entries2", 'FixedText', nXC+70, nY0+2, 45, nHeight, Label = "0", FontDescriptor = xFDSubTitle)
        self.xImport = self._addWidget('import_button', 'Button', self.xDialog.Width-90, nY0, 40, 12, Label = ui.get('import_button'), FontDescriptor = xFDSubTitle)
        self.xExport = self._addWidget('export_button', 'Button', self.xDialog.Width-45, nY0, 40, 12, Label = ui.get('export_button'), FontDescriptor = xFDSubTitle)

        #### Add word
        self._addWidget("add_section", 'FixedLine', nX1, nY1, 170, nHeight, Label = ui.get("add_section"), FontDescriptor = xFDTitle)
        self.xLemma = self._addWidget('lemma', 'Edit', nX1, nY1+10, 100, 14, Text = sWord, FontDescriptor = xFDTitle)
        self._addWidget('search_button', 'Button', nX1+105, nY1+11, 45, 12, Label = ui.get('search_button'), FontDescriptor = xFDSubTitle)
        self._addWidget('information_button', 'Button', nX1+155, nY1+11, 15, 12, Label = ui.get('information_button'), FontDescriptor = xFDSubTitle)

        # Radio buttons: main POS tag
        # Note: the only way to group RadioButtons is to create them successively
        self.xNA = self._addWidget('nom_adj', 'RadioButton', nX1, nY2+12, 60, nHeight, Label = ui.get("nom_adj"), HelpText = ":N:A")
        self.xN = self._addWidget('nom', 'RadioButton', nX1, nY2+22, 60, nHeight, Label = ui.get("nom"), HelpText = ":N")
        self.xA = self._addWidget('adj', 'RadioButton', nX1, nY2+32, 60, nHeight, Label = ui.get("adj"), HelpText = ":A")
        self.xM1 = self._addWidget('M1', 'RadioButton', nX1, nY3+12, 60, nHeight, Label = ui.get("M1"), HelpText = ":M1")
        self.xM2 = self._addWidget('M2', 'RadioButton', nX1, nY3+22, 60, nHeight, Label = ui.get("M2"), HelpText = ":M2")
        self.xMP = self._addWidget('MP', 'RadioButton', nX1, nY3+32, 60, nHeight, Label = ui.get("MP"), HelpText = ":MP")
        self.xV = self._addWidget('verb', 'RadioButton', nX1, nY4+2, 35, nHeight, Label = ui.get("verb"), FontDescriptor = xFDSubTitle, HelpText = ":V")
        self.xW = self._addWidget('adv', 'RadioButton', nX1, nY5+2, 35, nHeight, Label = ui.get("adverb"), FontDescriptor = xFDSubTitle, HelpText = ":W")
        self.xX = self._addWidget('other', 'RadioButton', nX1, nY6+2, 35, nHeight, Label = ui.get("other"), FontDescriptor = xFDSubTitle, HelpText = ":X")

        # Nom, adjectif
        self._addWidget("fl_nom_adj", 'FixedLine', nX1, nY2, 170, nHeight, Label = ui.get("common_name"), FontDescriptor = xFDSubTitle)
        self.xSepi = self._addWidget('Sepi', 'RadioButton', nX1+65, nY2+12, 50, nHeight, Label = ui.get("epi"), HelpText = ":e")
        self.xSmas = self._addWidget('Smas', 'RadioButton', nX1+65, nY2+22, 50, nHeight, Label = ui.get("mas"), HelpText = ":m")
        self.xSfem = self._addWidget('Sfem', 'RadioButton', nX1+65, nY2+32, 50, nHeight, Label = ui.get("fem"), HelpText = ":f")
        self._addWidget("fl_sep1", 'FixedLine', nX1, nY2, 1, nHeight)
        self.xSs = self._addWidget('Ss', 'RadioButton', nX1+115, nY2+12, 50, nHeight, Label = ui.get("-s"), HelpText = "·s")
        self.xSx = self._addWidget('Sx', 'RadioButton', nX1+115, nY2+22, 50, nHeight, Label = ui.get("-x"), HelpText = "·x")
        self.xSinv = self._addWidget('Sinv', 'RadioButton', nX1+115, nY2+32, 50, nHeight, Label = ui.get("inv"), HelpText = ":i")

        self._addWidget("alt_lemma_label", 'FixedLine', nX1+10, nY2+42, 160, nHeight, Label = ui.get("alt_lemma"))
        self.xAltLemma = self._addWidget('alt_lemma', 'Edit', nX1+10, nY2+52, 110, nHeight)
        self.xNA2 = self._addWidget('nom_adj2', 'RadioButton', nX1+10, nY2+65, 60, nHeight, Label = ui.get("nom_adj"), HelpText = ":N:A")
        self.xN2 = self._addWidget('nom2', 'RadioButton', nX1+10, nY2+75, 60, nHeight, Label = ui.get("nom"), HelpText = ":N")
        self.xA2 = self._addWidget('adj2', 'RadioButton', nX1+10, nY2+85, 60, nHeight, Label = ui.get("adj"), HelpText = ":A")
        self._addWidget("fl_sep2", 'FixedLine', nX1, nY2, 1, nHeight)
        self.xSepi2 = self._addWidget('Sepi2', 'RadioButton', nX1+70, nY2+65, 50, nHeight, Label = ui.get("epi"), HelpText = ":e")
        self.xSmas2 = self._addWidget('Smas2', 'RadioButton', nX1+70, nY2+75, 50, nHeight, Label = ui.get("mas"), HelpText = ":m")
        self.xSfem2 = self._addWidget('Sfem2', 'RadioButton', nX1+70, nY2+85, 50, nHeight, Label = ui.get("fem"), HelpText = ":f")
        self._addWidget("fl_sep3", 'FixedLine', nX1, nY2, 1, nHeight)
        self.xSs2 = self._addWidget('Ss2', 'RadioButton', nX1+120, nY2+65, 50, nHeight, Label = ui.get("-s"), HelpText = "·s")
        self.xSx2 = self._addWidget('Sx2', 'RadioButton', nX1+120, nY2+75, 50, nHeight, Label = ui.get("-x"), HelpText = "·x")
        self.xSinv2 = self._addWidget('Sinv2', 'RadioButton', nX1+120, nY2+85, 50, nHeight, Label = ui.get("inv"), HelpText = ":i")

        # Nom propre
        self._addWidget("fl_M", 'FixedLine', nX1, nY3, 170, nHeight, Label = ui.get("proper_name"), FontDescriptor = xFDSubTitle)
        self.xMepi = self._addWidget('Mepi', 'RadioButton', nX1+65, nY3+12, 50, nHeight, Label = ui.get("epi"), HelpText = ":e")
        self.xMmas = self._addWidget('Mmas', 'RadioButton', nX1+65, nY3+22, 50, nHeight, Label = ui.get("mas"), HelpText = ":m")
        self.xMfem = self._addWidget('Mfem', 'RadioButton', nX1+65, nY3+32, 50, nHeight, Label = ui.get("fem"), HelpText = ":f")

        # Verbe
        self._addWidget("fl_verb", 'FixedLine', nX2+30, nY4, 130, nHeight, FontDescriptor = xFDSubTitle)
        self.xV_i = self._addWidget('v_i', 'CheckBox', nX2, nY4+12, 60, nHeight, Label = ui.get("v_i"))
        self.xV_t = self._addWidget('v_t', 'CheckBox', nX2, nY4+20, 60, nHeight, Label = ui.get("v_t"))
        self.xV_n = self._addWidget('v_n', 'CheckBox', nX2, nY4+28, 60, nHeight, Label = ui.get("v_n"))
        self.xV_p = self._addWidget('v_p', 'CheckBox', nX2, nY4+36, 60, nHeight, Label = ui.get("v_p"))
        self.xV_m = self._addWidget('v_m', 'CheckBox', nX2, nY4+44, 60, nHeight, Label = ui.get("v_m"))

        self._addWidget('aux', 'FixedText', nX2+75, nY4+10, 90, nHeight, Label = ui.get("aux"))
        self.xV_ae = self._addWidget('v_ae', 'CheckBox', nX2+75, nY4+20, 90, nHeight, Label = ui.get("v_ae"))
        self.xV_aa = self._addWidget('v_aa', 'CheckBox', nX2+75, nY4+28, 90, nHeight, Label = ui.get("v_aa"))

        self.xV_pp = self._addWidget('v_pp', 'CheckBox', nX2+75, nY4+44, 90, nHeight, Label = ui.get("v_pp"))

        self._addWidget('v_pattern_label', 'FixedText', nX2, nY4+56, 75, nHeight, Label = ui.get('v_pattern'), Align = 2)
        self.xVpattern = self._addWidget('v_pattern', 'Edit', nX2+80, nY4+56, 80, nHeight)

        # Adverbe
        self._addWidget("fl_adv", 'FixedLine', nX2+30, nY5, 130, nHeight, FontDescriptor = xFDSubTitle)

        # Autre
        self._addWidget("fl_other", 'FixedLine', nX2+30, nY6, 130, nHeight, FontDescriptor = xFDSubTitle)
        self._addWidget('flexion_label', 'FixedText', nX2, nY6+11, 22, nHeight, Label = ui.get('flexion'), Align = 2)
        self.xFlexion = self._addWidget('flexion', 'Edit', nX2+25, nY6+10, 50, nHeight)
        self._addWidget('tags_label', 'FixedText', nX2+80, nY6+11, 27, nHeight, Label = ui.get('tags'), Align = 2)
        self.xTags = self._addWidget('tags', 'Edit', nX2+110, nY6+10, 50, nHeight)

        #### Generated words
        self._addWidget("gwords_section", 'FixedLine', nXB, nY1, 160, nHeight, Label = ui.get("new_section"), FontDescriptor = xFDTitle)
        self.xGridModelNew = self._addGrid("list_grid_gwords", nXB, nY1+10, 160, 240, [
            {"Title": ui.get("lex_flex"), "ColumnWidth": 80},
            {"Title": ui.get("lex_tags"), "ColumnWidth": 80}
        ], SelectionModel = uno.Enum("com.sun.star.view.SelectionType", "MULTI"))
        self.xAdd = self._addWidget('add_button', 'Button', nXB, nY1+255, 75, 12, Label = ui.get('add_button'), FontDescriptor = xFDSubTitle, TextColor = 0x55BB55, Enabled = False)
        self.xDelete = self._addWidget('delete_button', 'Button', nXB+80, nY1+255, 80, 12, Label = ui.get('delete_button'), FontDescriptor = xFDSubTitle, TextColor = 0xBB5555)

        #### Lexicon section
        self._addWidget("lexicon_section", 'FixedLine', nXC, nY1, 200, nHeight, Label = ui.get("lexicon_section"), FontDescriptor = xFDTitle)
        self.xGridModelLex = self._addGrid("list_grid_lexicon", nXC, nY1+10, 200, 240, [
            {"Title": ui.get("lex_flex"), "ColumnWidth": 65},
            {"Title": ui.get("lex_lemma"), "ColumnWidth": 50},
            {"Title": ui.get("lex_tags"), "ColumnWidth": 65}
        ], SelectionModel = uno.Enum("com.sun.star.view.SelectionType", "MULTI"))
        self._addWidget("num_of_entries_label1", 'FixedText', nXC, nY1+257, 60, nHeight, Label = ui.get("num_of_entries_label"), FontDescriptor = xFDSubTitle)
        self.xNumLex = self._addWidget("num_of_entries1", 'FixedText', nXC+65, nY1+257, 40, nHeight, Label = "0", FontDescriptor = xFDSubTitle)
        self.xSave = self._addWidget('save_button', 'Button', nXC+110, nY1+255, 45, 12, Label = ui.get('save_button'), FontDescriptor = xFDSubTitle, TextColor = 0x55BB55)
        self._addWidget('close_button', 'Button', nXC+160, nY1+255, 40, 12, Label = ui.get('close_button'), FontDescriptor = xFDSubTitle, TextColor = 0xBB5555)

        self.loadLexicon()

        # container
        self.xContainer = self.xSvMgr.createInstanceWithContext('com.sun.star.awt.UnoControlDialog', self.ctx)
        self.xContainer.setModel(self.xDialog)
        self.xGridControlNew = self.xContainer.getControl('list_grid_gwords')
        self.xGridControlLex = self.xContainer.getControl('list_grid_lexicon')
        #helpers.xray(self.xContainer.getControl('lemma'))
        self._createKeyListeners(['lemma', 'alt_lemma', "v_pattern", 'flexion', 'tags'], "Update")
        self._createActionListeners(['nom_adj', 'nom', 'adj', 'M1', 'M2', 'MP', 'verb', 'adv', 'other', \
                                     'Sepi', 'Smas', 'Sfem', 'Ss', 'Sx', 'Sinv', 'nom_adj2', 'nom2', 'adj2', \
                                     'Sepi2', 'Smas2', 'Sfem2', 'Ss2', 'Sx2', 'Sinv2', 'Mepi', 'Mmas', 'Mfem', \
                                     'v_i', 'v_t', 'v_n', 'v_p', 'v_m', 'v_ae', 'v_aa', 'v_pp'], "Update")
        self.xContainer.getControl('search_button').addActionListener(self)
        self.xContainer.getControl('search_button').setActionCommand('SearchWords')
        self.xContainer.getControl('information_button').addActionListener(self)
        self.xContainer.getControl('information_button').setActionCommand('TagsInfo')
        self.xContainer.getControl('add_button').addActionListener(self)
        self.xContainer.getControl('add_button').setActionCommand('Add')
        self.xContainer.getControl('delete_button').addActionListener(self)
        self.xContainer.getControl('delete_button').setActionCommand('Delete')
        self.xContainer.getControl('save_button').addActionListener(self)
        self.xContainer.getControl('save_button').setActionCommand('Save')
        self.xContainer.getControl('import_button').addActionListener(self)
        self.xContainer.getControl('import_button').setActionCommand('Import')
        self.xContainer.getControl('export_button').addActionListener(self)
        self.xContainer.getControl('export_button').setActionCommand('Export')
        self.xContainer.getControl('close_button').addActionListener(self)
        self.xContainer.getControl('close_button').setActionCommand('Close')
        self.xContainer.addTopWindowListener(self) # listener with XTopWindowListener methods
        self.xContainer.setVisible(True)  # True for non modal dialog
        xToolkit = self.xSvMgr.createInstanceWithContext('com.sun.star.awt.ExtToolkit', self.ctx)
        self.xContainer.createPeer(xToolkit, None)
        #self.xContainer.execute()        # For modal dialog

    def _createKeyListeners (self, lNames, sAction):
        for sName in lNames:
            self.xContainer.getControl(sName).addKeyListener(self)

    def _createActionListeners (self, lNames, sAction):
        for sName in lNames:
            self.xContainer.getControl(sName).addActionListener(self)
            self.xContainer.getControl(sName).setActionCommand(sAction)

    def newEntry (self, sWord):
        self.xLemma.Text = sWord

    # XActionListener
    def actionPerformed (self, xActionEvent):
        try:
            if xActionEvent.ActionCommand == "Update":
                self.updateGenWords()
            elif xActionEvent.ActionCommand == "SearchWords":
                self.launchSearchWords()
            elif xActionEvent.ActionCommand == "TagsInfo":
                self.launchTagsInfo()
            elif xActionEvent.ActionCommand == "Add":
                self.addToLexicon()
            elif xActionEvent.ActionCommand == "Delete":
                self.deleteSelectedEntries()
            elif xActionEvent.ActionCommand == "Save":
                self.saveLexicon()
            elif xActionEvent.ActionCommand == "Import":
                self.importDictionary()
            elif xActionEvent.ActionCommand == "Export":
                self.exportDictionary()
            elif xActionEvent.ActionCommand == 'Info':
                pass
            elif xActionEvent.ActionCommand == "Close":
                self.bClosed = True
                self.xContainer.dispose()           # Non modal dialog
                #self.xContainer.endExecute()       # Modal dialog
        except:
            traceback.print_exc()

    # XTopWindowListener (useful for non modal dialog only)
    def windowOpened (self, xEvent):
        return

    def windowClosing (self, xEvent):
        self.xContainer.dispose()           # Non modal dialog

    def windowClosed (self, xEvent):
        return

    def windowMinimized (self, xEvent):
        return

    def windowNormalized (self, xEvent):
        return

    def windowActivated (self, xEvent):
        return

    def windowDeactivated (self, xEvent):
        return

    # XKeyListener
    def keyPressed (self, xKeyEvent):
        pass

    def keyReleased (self, xKeyEvent):
        self.updateGenWords()

    # XJobExecutor
    def trigger (self, args):
        try:
            xDialog = LexiconEditor(self.ctx)
            xDialog.run()
        except:
            traceback.print_exc()

    # Code
    def launchSearchWords (self):
        xDialog = SearchWords.SearchWords(self.ctx)
        xDialog.run(self.sLang, self.oPersonalDicJSON)

    def launchTagsInfo (self):
        xDialog = TagsInfo.TagsInfo(self.ctx)
        xDialog.run(self.sLang)

    #@_waitPointer (don’t: strange behavior when dialog is not finished)
    def loadLexicon (self):
        xGridDataModel = self.xGridModelLex.GridDataModel
        xGridDataModel.removeAllRows()
        sJSON = self.xOptionNode.getPropertyValue("personal_dic")
        if sJSON:
            try:
                self.oPersonalDicJSON = json.loads(sJSON)
                oIBDAWG = ibdawg.IBDAWG(self.oPersonalDicJSON)
                for i, aEntry in enumerate(oIBDAWG.select()):
                    xGridDataModel.addRow(i, aEntry)
                self.xNumLex.Label = str(i+1)
                self.xNumDic.Label = str(i+1)
                self.xDateDic.Label = oIBDAWG.sDate
            except:
                sMessage = ui.get('not_loaded')
                sMessage += traceback.format_exc()
                MessageBox(self.xDocument, sMessage, ui.get('load_title'), ERRORBOX)
        else:
            self.xNumLex.Label = 0
            self.xNumDic.Label = 0
            self.xDateDic.Label = ui.get("void")

    @_waitPointer
    def importDictionary (self):
        spfImported = ""
        try:
            xFilePicker = self.xSvMgr.createInstanceWithContext('com.sun.star.ui.dialogs.FilePicker', self.ctx)  # other possibility: com.sun.star.ui.dialogs.SystemFilePicker
            xFilePicker.initialize([uno.getConstantByName("com.sun.star.ui.dialogs.TemplateDescription.FILEOPEN_SIMPLE")]) # seems useless
            xFilePicker.appendFilter("Supported files", "*.json")
            xFilePicker.setDefaultName("fr.__personal__.json") # useless, doesn’t work
            xFilePicker.setDisplayDirectory("")
            xFilePicker.setMultiSelectionMode(False)
            nResult = xFilePicker.execute()
            if nResult == 1:
                # lFile = xFilePicker.getSelectedFiles()
                lFile = xFilePicker.getFiles()
                #print(lFile)
                #MessageBox(self.xDocument, "File(s): " + str(lFile), "DEBUG", INFOBOX)
                spfImported = lFile[0][5:].lstrip("/") # remove file://
                if platform.system() != "Windows":
                    spfImported = "/" + spfImported
                spfImported = urllib.parse.unquote(spfImported)
        except:
            spfImported = os.path.join(os.path.expanduser("~"), "fr.__personal__.json") # workaround
        if spfImported and os.path.isfile(spfImported):
            with open(spfImported, "r", encoding="utf-8") as hDst:
                sJSON = hDst.read()
                try:
                    sTest = json.loads(sJSON)
                except:
                    sMessage = ui.get('wrong_json') % spfImported
                    MessageBox(self.xDocument, sMessage, ui.get('import_title'), ERRORBOX)
                else:
                    self.xOptionNode.setPropertyValue("personal_dic", sJSON)
                    self.xSettingNode.commitChanges()
                    self.loadLexicon()
        else:
            sMessage = ui.get('file_not_found') % spfImported
            MessageBox(self.xDocument, sMessage, ui.get('import_title'), ERRORBOX)

    @_waitPointer
    def saveLexicon (self):
        xGridDataModel = self.xGridModelLex.GridDataModel
        lEntry = []
        for i in range(xGridDataModel.RowCount):
            lEntry.append(xGridDataModel.getRowData(i))
        if lEntry:
            oDAWG = dawg.DAWG(lEntry, "S", "fr", "Français", "fr.__personal__", "Dictionnaire personnel")
            self.oPersonalDicJSON = oDAWG.getBinaryAsJSON()
            self.xOptionNode.setPropertyValue("personal_dic", json.dumps(self.oPersonalDicJSON, ensure_ascii=False))
            self.xSettingNode.commitChanges()
            self.xNumDic.Label = str(self.oPersonalDicJSON["nEntry"])
            self.xDateDic.Label = self.oPersonalDicJSON["sDate"]
        else:
            self.xOptionNode.setPropertyValue("personal_dic", "")
            self.xSettingNode.commitChanges()
            self.xNumDic.Label = "0"
            self.xDateDic.Label = ui.get("void")
        MessageBox(self.xDocument, ui.get('save_message'), ui.get('save_title'))

    def exportDictionary (self):
        try:
            xFilePicker = self.xSvMgr.createInstanceWithContext('com.sun.star.ui.dialogs.FilePicker', self.ctx)  # other possibility: com.sun.star.ui.dialogs.SystemFilePicker
            xFilePicker.initialize([uno.getConstantByName("com.sun.star.ui.dialogs.TemplateDescription.FILESAVE_SIMPLE")]) # seems useless
            xFilePicker.appendFilter("Supported files", "*.json")
            xFilePicker.setDefaultName("fr.__personal__.json") # useless, doesn’t work
            xFilePicker.setDisplayDirectory("")
            xFilePicker.setMultiSelectionMode(False)
            nResult = xFilePicker.execute()
            if nResult == 1:
                # lFile = xFilePicker.getSelectedFiles()
                lFile = xFilePicker.getFiles()
                spfExported = lFile[0][5:].lstrip("/") # remove file://
                if platform.system() != "Windows":
                    spfExported = "/" + spfExported
                spfExported = urllib.parse.unquote(spfExported)
                if not spfExported.endswith((".json", ".JSON")):
                    spfExported += ".json"
                #spfExported = os.path.join(os.path.expanduser("~"), "fr.personal.json")
                sJSON = self.xOptionNode.getPropertyValue("personal_dic")
                if sJSON:
                    with open(spfExported, "w", encoding="utf-8") as hDst:
                        hDst.write(sJSON)
                    sMessage = ui.get('export_message') % spfExported
                else:
                    sMessage = ui.get('empty_dictionary')
                MessageBox(self.xDocument, sMessage, ui.get('export_title'))
        except:
            sMessage = traceback.format_exc()
            MessageBox(self.xDocument, sMessage, ui.get('export_title'), ERRORBOX)

    def _getRadioValue (self, *args):
        for x in args:
            if x.State:
                return x.HelpText
        return None

    @_waitPointer
    def updateGenWords (self):
        self.lGeneratedFlex = []
        self.sLemma = self.xLemma.Text.strip()
        if self.sLemma:
            if self._getRadioValue(self.xNA, self.xN, self.xA):
                # Substantif
                sPOS = self._getRadioValue(self.xNA, self.xN, self.xA)
                sGenderTag = self._getRadioValue(self.xSepi, self.xSmas, self.xSfem)
                if sGenderTag:
                    if self.xSs.State:
                        self.lGeneratedFlex.append((self.sLemma, sPOS+sGenderTag+":s/*"))
                        self.lGeneratedFlex.append((self.sLemma+"s", sPOS+sGenderTag+":p/*"))
                    elif self.xSx.State:
                        self.lGeneratedFlex.append((self.sLemma, sPOS+sGenderTag+":s/*"))
                        self.lGeneratedFlex.append((self.sLemma+"x", sPOS+sGenderTag+":p/*"))
                    elif self.xSinv.State:
                        self.lGeneratedFlex.append((self.sLemma, sPOS+sGenderTag+":i/*"))
                    sLemma2 = self.xAltLemma.Text.strip()
                    if sLemma2 and self._getRadioValue(self.xNA2, self.xN2, self.xA2) and self._getRadioValue(self.xSepi2, self.xSmas2, self.xSfem2):
                        sTag2 = self._getRadioValue(self.xNA2, self.xN2, self.xA2) + self._getRadioValue(self.xSepi2, self.xSmas2, self.xSfem2)
                        if self.xSs2.State:
                            self.lGeneratedFlex.append((sLemma2, sTag2+":s/*"))
                            self.lGeneratedFlex.append((sLemma2+"s", sTag2+":p/*"))
                        elif self.xSx2.State:
                            self.lGeneratedFlex.append((sLemma2, sTag2+":s/*"))
                            self.lGeneratedFlex.append((sLemma2+"x", sTag2+":p/*"))
                        elif self.xSinv2.State:
                            self.lGeneratedFlex.append((sLemma2, sTag2+":i/*"))
            elif self._getRadioValue(self.xM1, self.xM2, self.xMP):
                # Nom propre
                sPOS = self._getRadioValue(self.xM1, self.xM2, self.xMP)
                self.sLemma = self.sLemma[0:1].upper() + self.sLemma[1:];
                sGenderTag = self._getRadioValue(self.xMepi, self.xMmas, self.xMfem)
                if sGenderTag:
                    self.lGeneratedFlex.append((self.sLemma, sPOS+sGenderTag+":i/*"))
            elif self.xV.State:
                # Verbe
                if self.sLemma.endswith(("er", "ir", "re")):
                    self.sLemma = self.sLemma.lower()
                    c_i = "i"  if self.xV_i.State  else "_"
                    c_t = "t"  if self.xV_t.State  else "_"
                    c_n = "n"  if self.xV_n.State  else "_"
                    c_p = "p"  if self.xV_p.State  else "_"
                    c_m = "m"  if self.xV_m.State  else "_"
                    c_ae = "e"  if self.xV_ae.State  else "_"
                    c_aa = "a"  if self.xV_aa.State  else "_"
                    sVerbTag = c_i + c_t + c_n + c_p + c_m + c_ae + c_aa
                    if "p" in sVerbTag and not sVerbTag.startswith("___p_"):
                        sVerbTag = sVerbTag.replace("p", "q")
                    if not sVerbTag.endswith("__") and not sVerbTag.startswith("____"):
                        sVerbPattern = self.xVpattern.Text.strip()
                        if not sVerbPattern:
                            # Utilisation du générateur de conjugaison
                            for sFlexion, sFlexTags in conjgen.conjugate(self.sLemma, sVerbTag, not bool(self.xV_pp.State)):
                                self.lGeneratedFlex.append((sFlexion, sFlexTags))
                        else:
                            # copie du motif d’un autre verbe : utilisation du conjugueur
                            if conj.isVerb(sVerbPattern):
                                oVerb = conj.Verb(self.sLemma, sVerbPattern)
                                for sTag1, dFlex in oVerb.dConj.items():
                                    if sTag1 != ":Q":
                                        for sTag2, sConj in dFlex.items():
                                            if sTag2.startswith(":") and sConj:
                                                self.lGeneratedFlex.append((sConj, ":V" + oVerb.cGroup + "_" + sVerbTag + sTag1 + sTag2))
                                    else:
                                        # participes passés
                                        if dFlex[":f:s"]:
                                            if dFlex[":m:p"]:
                                                self.lGeneratedFlex.append((dFlex[":m:s"], ":V" + oVerb.cGroup + "_" + sVerbTag + ":Q:A:m:s/*"))
                                                self.lGeneratedFlex.append((dFlex[":m:p"], ":V" + oVerb.cGroup + "_" + sVerbTag + ":Q:A:m:p/*"))
                                            else:
                                                self.lGeneratedFlex.append((dFlex[":m:s"], ":V" + oVerb.cGroup + "_" + sVerbTag + ":Q:A:m:i/*"))
                                            self.lGeneratedFlex.append((dFlex[":f:s"], ":V" + oVerb.cGroup + "_" + sVerbTag + ":Q:A:f:s/*"))
                                            self.lGeneratedFlex.append((dFlex[":f:p"], ":V" + oVerb.cGroup + "_" + sVerbTag + ":Q:A:f:p/*"))
                                        else:
                                            self.lGeneratedFlex.append((dFlex[":m:s"], ":V" + oVerb.cGroup + "_" + sVerbTag + ":Q:e:i/*"))
            elif self.xW.State:
                # Adverbe
                self.sLemma = self.sLemma.lower();
                self.lGeneratedFlex.append((self.sLemma, ":W/*"))
            elif self.xX.State:
                # Autre
                sFlexion = self.xFlexion.Text.strip()
                sTags = self.xTags.Text.strip()
                if sFlexion and sTags.startswith(":"):
                    self.lGeneratedFlex.append((sFlexion, sTags))
        self._showGenWords()

    def _showGenWords (self):
        xGridDataModel = self.xGridModelNew.GridDataModel
        xGridDataModel.removeAllRows()
        if not self.lGeneratedFlex:
            self.xAdd.Enabled = False
            return
        for i, (sFlexion, sTag) in enumerate(self.lGeneratedFlex):
            xGridDataModel.addRow(i, (sFlexion, sTag))
        self.xAdd.Enabled = True

    def _resetWidgets (self):
        self.xLemma.Text = ""
        self.xNA.State = False
        self.xN.State = False
        self.xA.State = False
        self.xM1.State = False
        self.xM2.State = False
        self.xMP.State = False
        self.xV.State = False
        self.xW.State = False
        self.xX.State = False
        self.xSepi.State = False
        self.xSmas.State = False
        self.xSfem.State = False
        self.xSs.State = False
        self.xSx.State = False
        self.xSinv.State = False
        self.xAltLemma.Text = ""
        self.xNA2.State = False
        self.xN2.State = False
        self.xA2.State = False
        self.xSepi2.State = False
        self.xSmas2.State = False
        self.xSfem2.State = False
        self.xSs2.State = False
        self.xSx2.State = False
        self.xSinv2.State = False
        self.xMepi.State = False
        self.xMmas.State = False
        self.xMfem.State = False
        self.xV_i.State = False
        self.xV_t.State = False
        self.xV_n.State = False
        self.xV_p.State = False
        self.xV_m.State = False
        self.xV_ae.State = False
        self.xV_aa.State = False
        self.xV_pp.State = False
        self.xVpattern.Text = ""
        self.xFlexion.Text = ""
        self.xTags.Text = ""
        self.xGridModelNew.GridDataModel.removeAllRows()

    @_waitPointer
    def addToLexicon (self):
        self.xAdd.Enabled = False
        xGridDataModelNew = self.xGridModelNew.GridDataModel
        xGridDataModelLex = self.xGridModelLex.GridDataModel
        nStart = xGridDataModelLex.RowCount
        for i in range(xGridDataModelNew.RowCount):
            sFlexion, sTag = xGridDataModelNew.getRowData(i)
            xGridDataModelLex.addRow(nStart + i, (sFlexion, self.sLemma, sTag))
        self.xSave.Enabled = True
        self.xNumLex.Label = str(int(self.xNumLex.Label) + xGridDataModelNew.RowCount)
        self._resetWidgets()

    @_waitPointer
    def deleteSelectedEntries (self):
        # generated entries
        xGridDataModel = self.xGridModelNew.GridDataModel
        #helpers.xray(xGridDataModel)
        for i in self.xGridControlNew.getSelectedRows():
            if i < xGridDataModel.RowCount:
                xGridDataModel.removeRow(i)
        self.xGridControlNew.deselectAllRows()
        # lexicon
        xGridDataModel = self.xGridModelLex.GridDataModel
        nSelectedEntries = len(self.xGridControlLex.getSelectedRows())
        for i in self.xGridControlLex.getSelectedRows():
            if i < xGridDataModel.RowCount:
                xGridDataModel.removeRow(i)
        self.xGridControlLex.deselectAllRows()
        self.xNumLex.Label = str(xGridDataModel.RowCount)


#g_ImplementationHelper = unohelper.ImplementationHelper()
#g_ImplementationHelper.addImplementation(LexiconEditor, 'net.grammalecte.LexiconEditor', ('com.sun.star.task.Job',))
