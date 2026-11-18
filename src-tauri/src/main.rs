// Descarga para Windows: uma janela própria que abre o Descarga (o site publicado).
// O app sempre mostra a versão mais nova — não precisa reinstalar a cada novidade.
//
// Ao fechar a janela (X) o app NÃO encerra: ele vai para a bandeja do Windows (ao lado do relógio)
// e continua rodando (calls, avisos). Clique no ícone para abrir de novo; botão direito > "Sair" encerra de vez.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WindowEvent,
};

fn mostrar_janela(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

fn main() {
    tauri::Builder::default()
        // se o app já está na bandeja e a pessoa abre de novo, só traz a janela de volta
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            mostrar_janela(app);
        }))
        .setup(|app| {
            let abrir = MenuItem::with_id(app, "abrir", "Abrir o Descarga", true, None::<&str>)?;
            let sair = MenuItem::with_id(app, "sair", "Sair do Descarga", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&abrir, &sair])?;

            let mut tray = TrayIconBuilder::with_id("descarga")
                .tooltip("Descarga")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, evento| match evento.id.as_ref() {
                    "abrir" => mostrar_janela(app),
                    "sair" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, evento| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = evento
                    {
                        mostrar_janela(tray.app_handle());
                    }
                });
            if let Some(icone) = app.default_window_icon() {
                tray = tray.icon(icone.clone());
            }
            tray.build(app)?;
            Ok(())
        })
        .on_window_event(|janela, evento| {
            // X da janela = esconder (continua funcionando em segundo plano)
            if let WindowEvent::CloseRequested { api, .. } = evento {
                api.prevent_close();
                let _ = janela.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("não foi possível abrir o Descarga");
}
