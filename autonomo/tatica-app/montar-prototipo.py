"""Monta o QuadraLab Tática num arquivo só.
Uso: python3 autonomo/tatica-app/montar-prototipo.py <arquivo-de-saida.html>          (para abrir no celular, sem servidor)
     python3 autonomo/tatica-app/montar-prototipo.py --site autonomo/tatica/index.html (quadralab.com.br/tatica)
Junta app.css, as situações (mty/situacoes-jogo.js), o manual completo, app.js e o Simulador de Decisões (autonomo/decisoes).
No --site o simulador vem do próprio site (/decisoes/); no arquivo solto ele vai dentro da página.
Teste fechado em quadralab.com.br/tatica por decisão do Richard em 14/11/2026 ("Joga no quadralab.com.br/tatica")."""
import os
import re
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", ".."))
DEC = os.path.join(RAIZ, "autonomo", "decisoes")
SITE = "--site" in sys.argv
ARGS = [a for a in sys.argv[1:] if a != "--site"]


def ler(*partes):
    with open(os.path.join(*partes), encoding="utf-8") as f:
        return f.read()


def sem_fim_script(t):
    assert "</script" not in t.lower(), "um script tem </script> no texto"
    return t


def montar(site):
    idx = ler(AQUI, "index.html")
    idx = idx.replace('<link rel="stylesheet" href="app.css">', "<style>" + ler(AQUI, "app.css") + "</style>")
    if site:
        carregar_sim = '<script>window.QLT_SIM_URL="/decisoes/index.html";</script>\n'
        idx = idx.replace("<!-- Protótipo (pedido do Richard em 14/11/2026): não publicar, sem conta, sem cobrança. Tudo fica só neste aparelho. -->",
                          "<!-- QuadraLab Tática em teste fechado (quadralab.com.br/tatica, decisão do Richard em 14/11/2026). ARQUIVO GERADO: edite autonomo/tatica-app/ e rode\n"
                          "     python3 autonomo/tatica-app/montar-prototipo.py --site autonomo/tatica/index.html (conferido em autonomo/tests/check-tatica-site.js).\n"
                          "     Sem conta, sem servidor e sem cobrança: tudo fica no aparelho. -->")
        assert "ARQUIVO GERADO" in idx
    else:
        # simulador: o index dele com o CSS e os scripts dentro, sem o cabeçalho e sem os convites da consultoria (que está parada)
        sim = ler(DEC, "index.html")
        corpo = re.search(r"<!--CORPO-->(.*)<!--/CORPO-->", sim, re.S).group(1)
        corpo = re.sub(r'<script src="([^"]+)"></script>', lambda m: "<script>" + sem_fim_script(ler(DEC, m.group(1))) + "</script>", corpo)
        css_sim = ('.topo,.rodape,.convite,a[href="#consultoria"],a[href="#modulo"],a[href*="player"],.pular{display:none!important}'
                   'body{padding-top:0!important;background:#fff!important}')
        sim_html = ('<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
                    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">'
                    "<style>" + ler(DEC, "decisoes.css") + "</style><style>" + css_sim + "</style>" + corpo)
        carregar_sim = ('<template id="simTpl">' + sim_html + "</template>\n<script>(function(){var t=document.getElementById('simTpl');"
                        "var h='<!doctype html><html lang=\"pt-BR\"><head></head><body>'+t.innerHTML+'</body></html>';"
                        "window.QLT_SIM_URL=URL.createObjectURL(new Blob([h],{type:'text/html'}));})();</script>\n")
    idx = idx.replace('<script src="../../mty/situacoes-jogo.js"></script>', carregar_sim + "<script>" + sem_fim_script(ler(RAIZ, "mty", "situacoes-jogo.js")) + "</script>")
    idx = idx.replace('<script src="manual-completo.js"></script>', "<script>" + sem_fim_script(ler(AQUI, "manual-completo.js")) + "</script>")
    idx = idx.replace('<script src="app.js"></script>', "<script>" + sem_fim_script(ler(AQUI, "app.js")) + "</script>")
    assert 'src="app.js"' not in idx and 'src="manual-completo.js"' not in idx and 'situacoes-jogo.js"' not in idx
    return idx


if __name__ == "__main__":
    saida = ARGS[0] if ARGS else os.path.join(AQUI, "quadralab-tatica-prototipo.html")
    html = montar(SITE)
    with open(saida, "w", encoding="utf-8") as f:
        f.write(html)
    print(saida, round(len(html.encode("utf-8")) / 1024), "KB")
