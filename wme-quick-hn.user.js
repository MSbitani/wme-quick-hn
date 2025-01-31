// ==UserScript==
// @name         WME Quick HN (DaveAcincy fork)
// @description  Quick House Numbers
// @version      2025.01.30.01
// @author       Vinkoy (forked by DaveAcincy)
// @match        https://beta.waze.com/*editor*
// @match        https://www.waze.com/*editor*
// @exclude      https://www.waze.com/*user/*editor/*
// @namespace    https://greasyfork.org/users/166713
// @homepage     https://www.waze.com/discuss/t/script-wme-quick-hn-daveacincy-fork/327021
// @require      https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// @grant        none
// @downloadURL  https://update.greasyfork.org/scripts/458651/WME%20Quick%20HN%20%28DaveAcincy%20fork%29.user.js
// @updateURL    https://update.greasyfork.org/scripts/458651/WME%20Quick%20HN%20%28DaveAcincy%20fork%29.meta.js
// ==/UserScript==

/* global W */
/* global I18n */
/* global $ */
/* global WazeWrap */

(function () {
    const _script_display_name = 'Quick HN';
    const _script_unique_id = 'wmeqhn';
    var counter = '0';
    var interval = 1;
    var policySafeHTML = null;
    var hnlayerobserver = null;
    var autoSetHN = false;
    var zoomKeys = false;
    var debug = false;
    var fillnext = false;
    var initCount = 0;

    var wmeSDK;

    window.SDK_INITIALIZED.then(() => {
        wmeSDK = getWmeSdk({ scriptId: _script_unique_id, scriptName: _script_display_name });
        wmeSDK.Events.once({ eventName: "wme-ready" }).then(onWmeReady);
    });

    function setupPolicy() {
        if (typeof trustedTypes !== "undefined") {
            policySafeHTML = trustedTypes.createPolicy("policySafeHTML", { createHTML: innerText => innerText });
        }
    }
    function createSafeHtml(text) {
        if (policySafeHTML !== null) {
            return policySafeHTML.createHTML(text);
        } else {
            return text;
        }
    }

    function onWmeReady() {
        initCount++;
        if (WazeWrap && WazeWrap.Ready)
            initialiseQuickHN();
        else {
            if (initCount == 1) {
                log('Waiting for WazeWrap...');
            } else if (initCount == 100) {
                console.error('Quick HN:', 'WazeWrap loading failed. Giving up.');
                return;
            }
            setTimeout(onWmeReady, 300);
        }
    }

    function createShortcut(id, desc, func, kcode) {/* SDK shortcuts for when that's fixed
    const shortcut = {
        callback: () => func,
        description: desc,
        shortcutId: id,
        shortcutKeys: kcode,
    };
    wmeSDK.Shortcuts.createShortcut(shortcut);*/

        I18n.translations[wmeSDK.Settings.getLocale().localeCode].keyboard_shortcuts.groups.wmeqhn.members[id] = desc;
        var short = {};
        short[kcode] = id;
        W.accelerators.addAction(id, { group: _script_unique_id });
        W.accelerators.events.register(id, null, func);
        W.accelerators._registerShortcuts(short);
    }

    function log(message) {
        console.log('QuickHN: ' + message);
    }

    function dlog(message, data = '') {
        if (debug) { console.log('QuickHN# ' + message, data); }
    }
    function tlog(message, data = '') {
        const t = new Date;
        const h = t.getHours();
        const m = t.getMinutes();
        const s = t.getSeconds();
        const hms = h + ":" + m + ":" + s;
        const ms = ('00' + t.getMilliseconds()).slice(-3);
        if (debug) { console.log('QHN:' + hms + '.' + ms + ': ' + message, data); }
    }

    function initialiseQuickHN() {
        setupPolicy();

        let group = _script_unique_id;
        W.accelerators.Groups[group] = [];
        W.accelerators.Groups[group].members = [];
        I18n.translations[wmeSDK.Settings.getLocale().localeCode].keyboard_shortcuts.groups[group] = [];
        I18n.translations[wmeSDK.Settings.getLocale().localeCode].keyboard_shortcuts.groups[group].description = _script_display_name;
        I18n.translations[wmeSDK.Settings.getLocale().localeCode].keyboard_shortcuts.groups[group].members = [];

        createShortcut("WME_QHN_newHN01", "New HN (+1)", () => addOrZoom(1), "t");
        createShortcut("WME_QHN_newHN02", "New HN (+2)", () => addOrZoom(2), "r");
        createShortcut("WME_QHN_newHNcust", "New HN (+CUSTOM_VALUE)", () => addOrZoom(document.getElementById('quick_hn_custominterval').value), "e");
        for (let key = 1; key <= 10; key++)
            createShortcut(`WME_QHN_newHN${key}`, `New HN (+${key})`, () => addOrZoom(key, key + 10), key % 10);
        localDataManager();
        wmeSDK.Sidebar.registerScriptTab().then(({ tabLabel, tabPane }) => {
            tabLabel.innerText = _script_display_name;
            tabLabel.title = _script_display_name + ' Settings';
            tabPane.innerHTML = createSafeHtml('<div>' +
                '<b>Quick House Numbers</b> v' + GM_info.script.version +
                '</br>' +
                '<div title="House number" style="display: flex; align-items: center;"><b>House number </b> <input id="quick_hn_housenumber" style="width: 0; flex-grow: 1;"/></div>' +
                '<div><input type="checkbox" name="quickHNAutoSetHNCheckBox" title="When enabled, Auto set next HN updates the next HN field based on the last HN created or moved" id="quickHNAutoSetHNCheckBox"><label for="quickHNAutoSetHNCheckBox">Auto set next HN on typed/moved HN</label></div>' +
                '<div><input type="checkbox" name="quickHNzoomKeysCheckBox" title="1-9 => Z11-19; 0 => Z20" id="quickHNzoomKeysCheckBox"><label for="quickHNzoomKeysCheckBox">Zoom Keys when no segment</label></div>' +
                '<div>Press <b>T</b> to add <u>HN +1</u> <i>(1,2,3...)</i></div>' +
                '<div>Press <b>R</b> to add <u>HN +2</u> <i>(1,3,5... or 2,4,6...)</i></div>' +
                '<div>Press <b>E</b> to add <u>HN +</u><input type="number" id="quick_hn_custominterval" style="width: 42px;margin-left: 6px;height: 22px;"></div>' +
                '<div>Press <b>1 - 9</b> to add <u>HN +x</u></div>' +
                '<div>Press <b>0</b> to add <u>HN +10</u></div>');

            localDataManager();

            $('#quickHNAutoSetHNCheckBox').change(function onAutosetCheckChanged() {
                autoSetHN = this.checked;
                if (autoSetHN)
                    WazeWrap.Events.register("afteraction", null, hnActionCheck);
                else
                    WazeWrap.Events.unregister("afteraction", null, hnActionCheck);
                wme_saveQuickHNOptions();
            });

            $('#quickHNzoomKeysCheckBox').change(function onZoomKeysCheckChanged() {
                zoomKeys = this.checked;
                wme_saveQuickHNOptions();
            });
            var hn = document.getElementById('quick_hn_housenumber');
            if (hn) {
                document.getElementById('quick_hn_housenumber').value = counter;
                document.getElementById('quick_hn_housenumber').onchange = function () {
                    counter = document.getElementById('quick_hn_housenumber').value;
                };

                //If user has Auto Set Next HN turned on, register an event to watch changes
                if (autoSetHN)
                    WazeWrap.Events.register("afteraction", null, hnActionCheck);
            }
        });

        hnlayerobserver = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                // Mutation is a NodeList and doesn't support forEach like an array
                for (var i = 0; i < mutation.addedNodes.length; i++) {
                    var addedNode = mutation.addedNodes[i];

                    // Only fire up if it's a node
                    if (addedNode.nodeType === Node.ELEMENT_NODE && addedNode.className == 'house-number is-active') {
                        var x = addedNode.querySelector('input');
                        if (x !== undefined) {
                            x.onfocus = function () { sethn(); };
                        }
                    }
                }

            });
        });

        wmeSDK.Events.on({
            eventName: "wme-selection-changed", eventHandler: () => {
                if (wmeSDK.Editing.getSelection()?.objectType == "segment") {
                    var maplayer = document.getElementById("WazeMap");
                    hnlayerobserver.observe(maplayer, { childList: true, subtree: true });
                } else
                    hnlayerobserver.disconnect();
            }
        });

        log("initialize complete");
    }

    function wme_saveQuickHNOptions() {
        if (localStorage) {
            var options = [];
            // preserve previous options which may get lost after logout
            if (localStorage.WMEquickHN)
                options = JSON.parse(localStorage.WMEquickHN);

            options[1] = document.getElementById('quick_hn_custominterval').value;
            options[2] = autoSetHN;
            options[3] = zoomKeys;

            localStorage.WMEquickHN = JSON.stringify(options);
        }
    }

    function localDataManager() {
        // restore saved settings
        var cust = 4;
        if (localStorage.WMEquickHN) {
            var options = JSON.parse(localStorage.WMEquickHN);
            if (options[1] !== undefined)
                cust = options[1];
            if (options[2] !== undefined)
                autoSetHN = options[2];
            if (options[3] !== undefined)
                zoomKeys = options[3];
        }
        const cele = document.getElementById('quick_hn_custominterval');
        if (cele) {
            cele.value = cust;
            cele.onchange = wme_saveQuickHNOptions;
        }

        $('#quickHNAutoSetHNCheckBox').prop('checked', autoSetHN);
        $('#quickHNzoomKeysCheckBox').prop('checked', zoomKeys);
        window.addEventListener("beforeunload", wme_saveQuickHNOptions, false);
    }

    //Watches changes for new/moved HNs and updates the counter and house number text box
    function hnActionCheck() {
        try {
            const lastAction = W.model.actionManager.getActions()[W.model.actionManager.getActionsNum() - 1];
            const actionHN = lastAction.houseNumber.getAttribute('number');
            if (counter != actionHN) {
                counter = actionHN;
                tlog('action: ' + actionHN, lastAction.houseNumber);
                if (document.getElementById('quick_hn_housenumber') !== null)
                    document.getElementById('quick_hn_housenumber').value = counter;
            }
        }
        catch {
            return;
        }
    }

    function activateEditTab(ind) {
        var ed = getElementsByClassName('segment-feature-editor');
        var tabs = ed[0].querySelector('wz-tabs');
        var tl = tabs.shadowRoot.querySelectorAll('.wz-tab-label');
        if (tl && tl.length > 0) {
            if (ind < 0) ind = tl.length + ind;
            tl[ind].click();
        }
    }

    function getElementsByClassName(classname, node) {
        if (!node)
            node = document.getElementsByTagName("body")[0];
        var a = [];
        var re = new RegExp('\\b' + classname + '\\b');
        var els = node.getElementsByTagName("*");
        for (var i = 0, j = els.length; i < j; i++)
            if (re.test(els[i].className)) a.push(els[i]);
        return a;
    }

    function addOrZoom(newInterval, zoom) {
        if (wmeSDK.Editing.getSelection()?.objectType == "segment") {
            interval = Number(newInterval);
            setFocus();
        }
        else if (zoomKeys && zoom) W.map.olMap.zoomTo(zoom);
    }

    async function setFocus() {
        tlog('setFocus');
        fillnext = true;
        $('#segment-edit-general > div:nth-child(2) > wz-button').click();
    }

    // this may be a hack but works for now.  https://stackoverflow.com/questions/30683628/react-js-setting-value-of-input
    function setNativeValue(element, value) {
        let lastValue = element.value;
        element.value = value;
        let event = new Event("input", { target: element, bubbles: true });
        // React 15
        event.simulated = true;
        // React 16
        let tracker = element._valueTracker;
        if (tracker) {
            tracker.setValue(lastValue);
        }
        element.dispatchEvent(event);
    }

    async function sethn() {
        tlog('sethn');
        var hn = $('div.house-number.is-active input');
        if (!fillnext || hn.val() !== "") return;

        dlog("sethn ctr " + counter + " ival " + interval);
        fillnext = false;

        const nextParts = counter.match(/[0-9]+|[a-z]|[A-Z]|\S/g);

        for (const [index, part] of nextParts.reverse().entries()) {
            if (!Number.isNaN(Number(part))) {
                nextParts[index] = (Number(part) + interval).toString().padStart(part.length, '0');
                break;
            }

            if (/[a-z]/i.test(part)) {
                let nextLetter = part.codePointAt(0) + (interval % 26);

                interval = Math.floor(interval / 26);

                if ((/[a-z]/.test(part) && nextLetter > 'z'.codePointAt(0)) ||
                    (/[A-Z]/.test(part) && nextLetter > 'Z'.codePointAt(0))) {
                    nextLetter -= 26;
                    interval++;
                }

                nextParts[index] = String.fromCodePoint(nextLetter);

                if (!interval) break;
            }
        }

        counter = nextParts.reverse().join('');

        if (document.getElementById('quick_hn_housenumber') !== null)
            document.getElementById('quick_hn_housenumber').value = counter;
        setNativeValue(hn[0], counter);
        await new Promise(r => setTimeout(r, 80));
        hn.blur();
    }
})();
