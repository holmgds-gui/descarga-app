// Descarga para Windows: uma janela própria que abre o Descarga (o site publicado).
// O app sempre mostra a versão mais nova — não precisa reinstalar a cada novidade.
//
// Ao fechar a janela (X) o app NÃO encerra: ele vai para a bandeja do Windows (ao lado do relógio)
// e continua rodando (calls, avisos). Clique no ícone para abrir de novo; botão direito > "Sair" encerra de vez.
//
// Atualização da própria casca do app: ao abrir (e pelo item "Procurar atualização" da bandeja) o app confere
// se há versão nova nos Releases do GitHub e, se houver, baixa, instala e reabre sozinho. O conteúdo (o site)
// já se atualiza sozinho; isto cobre só mudanças na casca (ex.: bandeja).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WindowEvent,
};
use tauri_plugin_updater::UpdaterExt;

/// Confere se há versão nova da casca. Com `instalar`, baixa e instala (o app reabre sozinho);
/// sem ele, só avisa no ícone da bandeja (para não derrubar uma call em andamento).
/// Devolve true se há atualização.
async fn atualizar(app: &AppHandle, instalar: bool) -> bool {
    let Ok(updater) = app.updater() else { return false };
    let Ok(Some(nova)) = updater.check().await else { return false };
    if let Some(t) = app.tray_by_id("descarga") {
        let _ = t.set_tooltip(Some(if instalar {
            "Descarga — atualizando…"
        } else {
            "Descarga — há atualização: botão direito > Procurar atualização"
        }));
    }
    if instalar {
        let _ = nova.download_and_install(|_, _| {}, || {}).await;
    }
    true
}

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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let abrir = MenuItem::with_id(app, "abrir", "Abrir o Descarga", true, None::<&str>)?;
            let sair = MenuItem::with_id(app, "sair", "Sair do Descarga", true, None::<&str>)?;
            let procurar = MenuItem::with_id(app, "atualizar", "Procurar atualização", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&abrir, &procurar, &sair])?;

            let mut tray = TrayIconBuilder::with_id("descarga")
                .tooltip("Descarga")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, evento| match evento.id.as_ref() {
                    "abrir" => mostrar_janela(app),
                    "atualizar" => {
                        let app = app.clone();
                        tauri::async_runtime::spawn(async move {
                            let achou = atualizar(&app, true).await;
                            if !achou {
                                if let Some(t) = app.tray_by_id("descarga") {
                                    let _ = t.set_tooltip(Some("Descarga — já está na versão mais nova"));
                                }
                            }
                        });
                    }
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

            // ao abrir: instala sozinho. Depois, de 6 em 6 horas (o app pode ficar dias na bandeja) só avisa no ícone.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                atualizar(&handle, true).await;
                loop {
                    tokio::time::sleep(std::time::Duration::from_secs(6 * 60 * 60)).await;
                    atualizar(&handle, false).await;
                }
            });
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
