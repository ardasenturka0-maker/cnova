# Tek sunuculuk ClinicNova kurulumu

Hedef: Ubuntu 24.04 LTS, 4 vCPU, 8 GB RAM, 160 GB+ disk ve sabit IPv4 bulunan Türkiye lokasyonlu bir sunucu.

1. `env.deploy.example` dosyasını repo köküne `.env.deploy`, `.env.production.example` dosyasını `.env.production` olarak kopyalayın.
2. Gerçek alan adı, PostgreSQL parolası, ClinicNova secret değerleri, uzak yedek ve alarm adreslerini doldurun.
3. `ops/deploy/secrets/rclone.conf` içine yalnız bu yedek hedefinin kimliğini koyun; dosya Git'e girmez.
4. Alan adının A kaydını sunucu IP'sine yönlendirin ve TCP 22/80/443 ile UDP 443 erişimini sağlayın.
5. `sudo bash ops/deploy/install-ubuntu.sh` çalıştırın.
6. İlk klinik hesabını gerçek değerleri girerek oluşturun:

```bash
docker compose --env-file .env.deploy -f docker-compose.production.yml --profile tools run --rm \
  -e CLINIC_NAME="Klinik Adı" -e CLINIC_SLUG="klinik-kodu" \
  -e BRANCH_NAME="Merkez" -e BRANCH_CITY="İstanbul" \
  -e OWNER_NAME="Klinik Sahibi" -e OWNER_EMAIL="sahip@klinik.com" \
  -e OWNER_PASSWORD="Güçlü ve benzersiz parola" bootstrap
```
7. İlk yedeği `bash ops/deploy/backup-now.sh`, gerçek geri yükleme provasını `bash ops/deploy/restore-test-now.sh` ile çalıştırın.

Compose ağı PostgreSQL'i internete açmaz. Caddy yalnız 80/443 portlarını yayımlar; HTTPS sertifikasını otomatik yönetir. Uygulama root olmayan kullanıcıyla, Linux capability'leri kaldırılmış biçimde çalışır. ClamAV imzaları ayrı serviste güncellenir ve uygulamaya salt okunur bağlanır. Kurulum betiği günlük yedek/çöp temizliği/audit sabitleme, beş dakikalık sağlık kontrolü ve haftalık geri yükleme testi için ayrı cron dosyası oluşturur.
