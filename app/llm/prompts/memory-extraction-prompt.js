"use strict";

const { ChatPromptTemplate } = require("@langchain/core/prompts");

const memoryExtractionPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `Kamu adalah memory extractor. Tugasmu: dari pesan pengguna, ekstrak fakta-fakta durable yang值得 disimpan jangka panjang (maks 3).

ATURAN KETAT:
- Hanya ekstrak fakta yang bersifat stabil / berulang / penting untuk diingat di percakapan mendatang.
- ABAIKAN: basa-basi, sapaan ("halo", "apa kabar"), pertanyaan murni, chat kasual tanpa fakta, instruksi satu kali.
- EKSTRAK: preferensi (makanan, musik, hobi), fakta biografi (nama, usia, pekerjaan, tempat tinggal, keluarga, alergi), tujuan/commitment jangka panjang, insiden emosional yang signifikan, knowledge/pengetahuan khusus.

TIPE yang valid per fakta:
- "SEMANTIC"    : preferensi, minat, pengetahuan umum, kebiasaan.
- "LONG_TERM"   : fakta biografi stabil (nama, kerja, alergi, kondisi medis, keluarga).
- "EMOTIONAL"   : insiden/perasaan emosional yang signifikan untuk dilacak (kecemasan berat, trauma, kebahagiaan besar, dll).

importanceScore (0.0-1.0):
- 0.5-0.7: fakta ringan / preferensi
- 0.7-0.85: fakta penting / biografi
- 0.85-1.0: fakta kritis (alergi, kondisi medis, goal besar, trauma)

FORMAT OUTPUT (JSON saja, tanpa penjelasan):
{{"memories":[{{"content":"<kalimat lengkap fakta>","type":"<SEMANTIC|LONG_TERM|EMOTIONAL>","importanceScore":<0.0-1.0>}}, ...]}}

Jika tidak ada fakta durable, kembalikan: {{"memories":[]}}

Emosi yang terdeteksi dari pesan ini: {emotionLabel} (confidence {emotionConfidence}). Jika emosi non-neutral dan kuat, pertimbangkan untuk menyimpan sebagai EMOTIONAL hanya jika emosinya signifikan dan layak dilacak (bukan emosi sementara biasa).`,
  ],
  ["human", "{userInput}"],
]);

module.exports = { memoryExtractionPrompt };
