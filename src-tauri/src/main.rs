// Descarga para Windows: uma janela própria que abre o Descarga (o site publicado).
// O app sempre mostra a versão mais nova — não precisa reinstalar a cada novidade.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("não foi possível abrir o Descarga");
}
