package com.gymix.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Gymix's own small plugins (the home-screen widget's connection).
        registerPlugin(WidgetPlugin.class);
        registerPlugin(NfcPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
