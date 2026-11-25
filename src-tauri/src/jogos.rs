// Detecta qual jogo está aberto, pelo nome do programa em execução, para mostrar "Jogando X" no perfil.
// Só olha o NOME dos programas (nada de janelas, telas ou arquivos) e só o resultado (o nome do jogo) sai do app.
// Para incluir mais jogos, é só acrescentar uma linha: (nome do .exe em minúsculas, nome que aparece).

const JOGOS: &[(&str, &str)] = &[
    ("valorant-win64-shipping.exe", "VALORANT"),
    ("leagueclient.exe", "League of Legends"),
    ("league of legends.exe", "League of Legends"),
    ("cs2.exe", "Counter-Strike 2"),
    ("dota2.exe", "Dota 2"),
    ("fortniteclient-win64-shipping.exe", "Fortnite"),
    ("robloxplayerbeta.exe", "Roblox"),
    ("minecraft.windows.exe", "Minecraft"),
    ("gta5.exe", "Grand Theft Auto V"),
    ("eldenring.exe", "ELDEN RING"),
    ("overwatch.exe", "Overwatch 2"),
    ("rocketleague.exe", "Rocket League"),
    ("r5apex.exe", "Apex Legends"),
    ("tslgame.exe", "PUBG"),
    ("rainbowsix.exe", "Rainbow Six Siege"),
    ("fc25.exe", "EA SPORTS FC 25"),
    ("fc26.exe", "EA SPORTS FC 26"),
    ("genshinimpact.exe", "Genshin Impact"),
    ("terraria.exe", "Terraria"),
    ("among us.exe", "Among Us"),
    ("warframe.x64.exe", "Warframe"),
    ("cyberpunk2077.exe", "Cyberpunk 2077"),
    ("stardew valley.exe", "Stardew Valley"),
    ("palworld-win64-shipping.exe", "Palworld"),
    ("hollow knight.exe", "Hollow Knight"),
    ("hades.exe", "Hades"),
    ("fallguys_client_game.exe", "Fall Guys"),
    ("destiny2.exe", "Destiny 2"),
    ("witcher3.exe", "The Witcher 3"),
    ("rdr2.exe", "Red Dead Redemption 2"),
    ("sekiro.exe", "Sekiro"),
    ("hogwartslegacy.exe", "Hogwarts Legacy"),
    ("brawlhalla.exe", "Brawlhalla"),
    ("tf2.exe", "Team Fortress 2"),
    ("left4dead2.exe", "Left 4 Dead 2"),
    ("pcsx2-qt.exe", "PCSX2"),
    ("dolphin.exe", "Dolphin"),
    ("retroarch.exe", "RetroArch"),
];

/// Devolve o nome do primeiro jogo conhecido que aparece entre os programas em execução.
pub fn detectar<I, S>(programas: I) -> Option<&'static str>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let abertos: Vec<String> = programas.into_iter().map(|p| p.as_ref().to_lowercase()).collect();
    JOGOS
        .iter()
        .find(|(exe, _)| abertos.iter().any(|a| a == exe))
        .map(|(_, nome)| *nome)
}

#[cfg(test)]
mod testes {
    use super::detectar;

    #[test]
    fn acha_jogo_ignorando_maiusculas() {
        assert_eq!(detectar(["explorer.exe", "VALORANT-Win64-Shipping.exe"]), Some("VALORANT"));
    }

    #[test]
    fn sem_jogo_devolve_nada() {
        assert_eq!(detectar(["chrome.exe", "Spotify.exe"]), None);
    }
}
