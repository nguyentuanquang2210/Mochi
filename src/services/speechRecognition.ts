/**
 * Dịch vụ nhận diện giọng nói (Speech-to-Text) hoàn toàn miễn phí
 * Sử dụng mô hình OpenAI Whisper chuẩn quốc tế không cần API key trả phí.
 */

export const SpeechRecognitionService = {
  /**
   * Chuẩn hóa chuỗi văn bản (chữ thường, bỏ dấu câu và khoảng trắng thừa)
   */
  normalizeText(str: string): string {
    return (str || '')
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  /**
   * So sánh phát âm của người dùng với từ mục tiêu
   */
  isMatch(spoken: string, targetWord: string): boolean {
    const cleanSpoken = this.normalizeText(spoken);
    const cleanTarget = this.normalizeText(targetWord);

    if (!cleanSpoken || !cleanTarget) return false;

    // Khớp tuyệt đối
    if (cleanSpoken === cleanTarget) return true;

    // Khớp nếu chuỗi chứa từ mục tiêu như một từ riêng biệt
    const tokens = cleanSpoken.split(' ');
    if (tokens.includes(cleanTarget)) return true;

    // Khớp nếu từ mục tiêu có nhiều từ (cụm từ) và nằm trọn trong chuỗi đã nói
    if (cleanSpoken.includes(cleanTarget)) return true;

    return false;
  },

  /**
   * Gửi file âm thanh đã thu từ thiết bị (.m4a / .wav) lên endpoint Whisper để nhận diện chữ
   */
  async transcribeAudio(fileUri: string): Promise<string | null> {
    try {
      const formData = new FormData();
      formData.append('files', {
        uri: fileUri,
        type: 'audio/m4a',
        name: 'speech.m4a'
      } as any);

      // 1. Tải file âm thanh lên server
      const uploadController = new AbortController();
      const uploadTimeout = setTimeout(() => uploadController.abort(), 8000);

      const uploadRes = await fetch('https://openai-whisper.hf.space/gradio_api/upload', {
        method: 'POST',
        body: formData,
        signal: uploadController.signal
      });
      clearTimeout(uploadTimeout);

      if (!uploadRes.ok) {
        console.warn('Upload audio failed with status:', uploadRes.status);
        return null;
      }

      const files = await uploadRes.json();
      if (!Array.isArray(files) || !files[0]) {
        console.warn('Invalid upload response:', files);
        return null;
      }
      const uploadedPath = files[0];

      // 2. Tham gia hàng đợi xử lý dự đoán Gradio SSE
      const session_hash = Math.random().toString(36).substring(2);
      const joinController = new AbortController();
      const joinTimeout = setTimeout(() => joinController.abort(), 8000);

      const joinRes = await fetch('https://openai-whisper.hf.space/gradio_api/queue/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [
            { path: uploadedPath, meta: { _type: 'gradio.FileData' } },
            'transcribe'
          ],
          fn_index: 2,
          session_hash: session_hash
        }),
        signal: joinController.signal
      });
      clearTimeout(joinTimeout);

      if (!joinRes.ok) {
        console.warn('Queue join failed with status:', joinRes.status);
        return null;
      }

      // 3. Đọc kết quả từ luồng Server-Sent Events (SSE)
      const dataController = new AbortController();
      const dataTimeout = setTimeout(() => dataController.abort(), 12000);

      const streamRes = await fetch(
        `https://openai-whisper.hf.space/gradio_api/queue/data?session_hash=${session_hash}`,
        { signal: dataController.signal }
      );
      clearTimeout(dataTimeout);

      if (!streamRes.ok) {
        return null;
      }

      const streamText = await streamRes.text();

      // Phân tích dòng kết quả 'process_completed'
      const lines = streamText.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(trimmed.substring(6));
            if (parsed.msg === 'process_completed' && parsed.output?.data?.[0]) {
              const result = String(parsed.output.data[0]).trim();
              return result || null;
            }
          } catch {}
        }
      }

      // Fallback regex nếu JSON không phân tích được trực tiếp
      const match = streamText.match(/"output"\s*:\s*\{\s*"data"\s*:\s*\[\s*"([^"]+)"/);
      if (match && match[1]) {
        return match[1].trim();
      }

      return null;
    } catch (err: any) {
      console.warn('Lỗi nhận diện giọng nói qua Whisper:', err?.message || err);
      return null;
    }
  }
};
