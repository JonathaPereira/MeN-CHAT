# Fixtures de mídia

`audio-duracao-incorreta.webm` contém dois segundos de seno sintetizado (440 Hz, 48 kHz, Opus 32 kbit/s). O elemento EBML Duration foi alterado de 2008 para 600000 milissegundos, sem alterar os pacotes de áudio. O navegador lê duração de 600 s no cabeçalho, enquanto OfflineAudioContext decodifica 2 s reais. Não contém voz de usuário.

Geração:

```bash
ffmpeg -v error -f lavfi -i sine=frequency=440:sample_rate=48000:duration=2 -c:a libopus -b:a 32k /tmp/two-seconds.webm -y
```

Depois, em Python, substituir os oito bytes big-endian imediatamente após `44 89 88` por `struct.pack('>d', 600000)`. A fixture deve ser enviada como `audio/webm` no teste; a associação de extensão `.webm` do sistema pode identificá-la como vídeo.

O teste de navegador valida metadados, tempo conferido, seek, término, repetição e ausência de novo download durante polling.
