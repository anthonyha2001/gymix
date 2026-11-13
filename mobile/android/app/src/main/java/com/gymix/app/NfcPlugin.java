package com.gymix.app;

import android.app.Activity;
import android.nfc.FormatException;
import android.nfc.NdefMessage;
import android.nfc.NdefRecord;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.nfc.tech.Ndef;
import android.nfc.tech.NdefFormatable;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;

// "GymixNfc" in JavaScript (web/src/lib/nfc.ts): writes a link onto a blank NFC
// sticker held against the phone, so staff never need another app. Uses reader
// mode, which only listens while the app is open and a write is waiting.
// Rejections carry a code the website turns into a message: cancelled,
// unavailable, disabled, locked, failed.
@CapacitorPlugin(name = "GymixNfc")
public class NfcPlugin extends Plugin {

    private PluginCall pending;
    private NdefMessage message;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        NfcAdapter adapter = NfcAdapter.getDefaultAdapter(getContext());
        JSObject ret = new JSObject();
        ret.put("available", adapter != null);
        ret.put("enabled", adapter != null && adapter.isEnabled());
        call.resolve(ret);
    }

    @PluginMethod
    public void writeUrl(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("url is required", "failed");
            return;
        }
        NfcAdapter adapter = NfcAdapter.getDefaultAdapter(getContext());
        if (adapter == null) {
            call.reject("This phone has no NFC", "unavailable");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("NFC is off", "disabled");
            return;
        }
        finish(null, "cancelled", "Replaced by a new write");
        message = new NdefMessage(new NdefRecord[] { NdefRecord.createUri(url) });
        pending = call;
        Activity activity = getActivity();
        int flags = NfcAdapter.FLAG_READER_NFC_A | NfcAdapter.FLAG_READER_NFC_B | NfcAdapter.FLAG_READER_NFC_F
            | NfcAdapter.FLAG_READER_NFC_V | NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS;
        activity.runOnUiThread(() -> adapter.enableReaderMode(activity, this::onTag, flags, null));
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        finish(null, "cancelled", "Cancelled");
        call.resolve();
    }

    // Leaving the app stops reader mode, so a waiting write is cancelled.
    @Override
    protected void handleOnPause() {
        finish(null, "cancelled", "The app was closed");
        super.handleOnPause();
    }

    private void onTag(Tag tag) {
        NdefMessage msg = message;
        if (msg == null) return;
        try {
            Ndef ndef = Ndef.get(tag);
            if (ndef != null) {
                ndef.connect();
                try {
                    if (!ndef.isWritable()) {
                        finish(null, "locked", "This sticker is locked");
                        return;
                    }
                    if (ndef.getMaxSize() < msg.getByteArrayLength()) {
                        finish(null, "failed", "The link doesn't fit on this sticker");
                        return;
                    }
                    ndef.writeNdefMessage(msg);
                } finally {
                    ndef.close();
                }
                finish(true, null, null);
                return;
            }
            NdefFormatable formatable = NdefFormatable.get(tag);
            if (formatable != null) {
                formatable.connect();
                try {
                    formatable.format(msg);
                } finally {
                    formatable.close();
                }
                finish(true, null, null);
                return;
            }
            finish(null, "failed", "This sticker can't hold a link");
        } catch (IOException | FormatException | SecurityException e) {
            // Usually the phone moved off the sticker; keep listening for another try.
        }
    }

    // Resolves (ok) or rejects (code) the waiting write, once, and stops listening.
    private synchronized void finish(Boolean ok, String code, String text) {
        PluginCall call = pending;
        pending = null;
        message = null;
        Activity activity = getActivity();
        if (activity != null) {
            activity.runOnUiThread(() -> {
                NfcAdapter adapter = NfcAdapter.getDefaultAdapter(getContext());
                if (adapter != null) adapter.disableReaderMode(activity);
            });
        }
        if (call == null) return;
        if (ok != null && ok) call.resolve();
        else call.reject(text, code);
    }
}
