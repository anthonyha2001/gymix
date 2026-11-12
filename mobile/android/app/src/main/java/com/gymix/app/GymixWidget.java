package com.gymix.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

// The Gymix home-screen widget: how busy the gym is right now, days left on
// the membership, today's workout and visits this month. Tapping it opens
// the app. Data comes from /api/widget with the token the app saved
// (WidgetPlugin); it refreshes every 30 minutes and whenever the app opens.
public class GymixWidget extends AppWidgetProvider {
    static final String PREFS = "gymix_widget";
    private static final ExecutorService POOL = Executors.newSingleThreadExecutor();

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        final PendingResult pending = goAsync();
        final Context app = context.getApplicationContext();
        POOL.execute(() -> {
            try {
                JSONObject data = fetch(app);
                for (int id : ids) manager.updateAppWidget(id, render(app, data));
            } finally {
                pending.finish();
            }
        });
    }

    private static JSONObject fetch(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String url = prefs.getString("url", null);
        String token = prefs.getString("token", null);
        if (url == null || token == null) return null;
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("Accept", "application/json");
            if (conn.getResponseCode() != 200) return null;
            StringBuilder body = new StringBuilder();
            try (BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()))) {
                String line;
                while ((line = in.readLine()) != null) body.append(line);
            }
            JSONObject json = new JSONObject(body.toString());
            // Kept, so the widget shows the last numbers when offline.
            prefs.edit().putString("last", json.toString()).apply();
            return json;
        } catch (Exception e) {
            String last = prefs.getString("last", null);
            try {
                return last == null ? null : new JSONObject(last);
            } catch (Exception ignored) {
                return null;
            }
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static RemoteViews render(Context context, JSONObject d) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.gymix_widget);
        Intent open = new Intent(context, MainActivity.class);
        String host = context.getString(R.string.gymix_host);
        if (!host.isEmpty()) open.setData(Uri.parse("https://" + host + "/portal")).setAction(Intent.ACTION_VIEW);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        v.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        if (d == null || !d.optBoolean("member", false)) {
            v.setTextViewText(R.id.widget_gym, "Gymix");
            v.setTextViewText(R.id.widget_inside, "–");
            v.setTextViewText(R.id.widget_level, "Open Gymix to connect");
            v.setViewVisibility(R.id.widget_row, View.GONE);
            return v;
        }
        v.setViewVisibility(R.id.widget_row, View.VISIBLE);
        v.setTextViewText(R.id.widget_gym, d.optString("gym", "Gymix"));
        v.setTextViewText(R.id.widget_inside, String.valueOf(d.optInt("inside", 0)));
        v.setTextViewText(R.id.widget_level, levelText(d.optString("level", "")));
        v.setTextViewText(R.id.widget_days, d.isNull("days_left") ? "–" : String.valueOf(d.optInt("days_left")));
        v.setTextViewText(R.id.widget_visits, String.valueOf(d.optInt("visits_month", 0)));
        v.setTextViewText(R.id.widget_today, d.isNull("today") ? "Rest day" : d.optString("today"));
        return v;
    }

    private static String levelText(String level) {
        switch (level) {
            case "quiet": return "inside · quiet now";
            case "moderate": return "inside · getting busy";
            case "busy": return "inside · busy now";
            case "full": return "inside · full";
            default: return "inside now";
        }
    }
}
