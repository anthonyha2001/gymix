package com.gymix.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// "GymixWidget" in JavaScript: the app hands the home-screen widget where to
// ask for its data and the person's widget token, then asks it to refresh.
@CapacitorPlugin(name = "GymixWidget")
public class WidgetPlugin extends Plugin {

    @PluginMethod
    public void connect(PluginCall call) {
        String url = call.getString("url");
        String token = call.getString("token");
        if (url == null || token == null) {
            call.reject("url and token are required");
            return;
        }
        Context context = getContext();
        context.getSharedPreferences(GymixWidget.PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString("url", url)
            .putString("token", token)
            .apply();
        refresh(context);
        call.resolve();
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        Context context = getContext();
        context.getSharedPreferences(GymixWidget.PREFS, Context.MODE_PRIVATE).edit().clear().apply();
        refresh(context);
        call.resolve();
    }

    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, GymixWidget.class));
        if (ids.length == 0) return;
        Intent intent = new Intent(context, GymixWidget.class);
        intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        context.sendBroadcast(intent);
    }
}
