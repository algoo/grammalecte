# Building Grammalecte

# How to build Grammalecte

## Required ##

For building:

* Python 3.7+ > [download](https://www.python.org/)
* NodeJS (LTS version) > [download](https://nodejs.org/)
  * npm (should be installed with NodeJS)
  * web-ext > [instructions](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/)

For testing:

* Firefox Developer > [download](https://www.mozilla.org/en-US/firefox/developer/)
* Thunderbird > [download](https://www.thunderbird.net/)


## Commands ##

**Build a language**

    make.py LANG

> Generate the LibreOffice extension and the package folder.
> LANG is the lang code (ISO 639).
> This script uses the file `config.ini` in the folder `gc_lang/LANG`.

**First build**

    make.py LANG -js

> This command is required to generate all necessary files.

**Options**

`-b --build_data`

> Launch the script `build_data.py` in the folder `gc_lang/LANG`.

`-d --dict`

> Generate the indexable binary dictionary from the lexicon in the folder `lexicons`.

`-js --javascript`

> Also generate JavaScript extensions.
> Without this option, only Python modules, data and extensions are generated.

`-t --tests`

> Run unit tests.

`-i --install`

> Install the LibreOffice extension.

`-fx --firefox`

> Launch Firefox.
> Unit tests can be launched from the menu (Tests section).

`-fxd --firefox_dev`

> Launch Firefox Developer.
> Unit tests can be launched from the menu (Tests section).

`-fxn --firefox_nightly`

> Launch Firefox Nightly.
> Unit tests can be launched from the menu (Tests section).

`-tb --thunderbird`

> Launch Thunderbird.


## Examples ##

Full rebuild:

    make.py LANG -b -d -js

After modifying grammar rules:

    make.py LANG -t

If you modify the lexicon:

    make.py LANG -d -js

If you modify your script `build_data.py`:

    make.py LANG -b -js
