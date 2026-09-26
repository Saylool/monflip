# MonFlip

**Piyasanın bir sonraki yönünü seç.**

MonFlip, **Monad Testnet** üzerinde çalışan bir fiyat yönü tahmin uygulamasıdır. BTC, ETH veya MON seç; fiyatın **30 saniye, 1 dakika veya 5 dakika** içinde yukarı mı aşağı mı gideceğini tahmin et. Cüzdanını bağlayarak test MON ile deneyebilirsin.

**Türkçe** · [English](README.en.md)

[Canlı demoyu aç](https://monflip-snowy.vercel.app) · [Testnet sözleşmesini incele](https://testnet.monadscan.com/address/0x37823aa03c00bf91b461fab176139c722952d0b0) · [Test MON al](https://faucet.monad.xyz)

> Bu proje bir hackathon demosudur. Yalnızca test MON kullanılır; gerçek para ürünü değildir.

## Neler sunuyor?

- **Üç varlık:** Bitcoin (BTC), Ethereum (ETH) ve Monad (MON).
- **Üç süre:** 30 saniye, 1 dakika ve 5 dakika.
- **Cüzdanla hesap:** E-posta veya şifre gerekmez; uygulama bakiyen cüzdan adresinle eşleşir.
- **Zincir üzerinde işlemler:** Yatırma, çekme, tahminler ve sonuçlar akıllı sözleşmede tutulur.
- **CoinGecko fiyatları:** USD cinsinden referans fiyatlar ve son veri zamanı.
- **Türkçe / İngilizce arayüz:** Telefon ve masaüstüne uygun mor premium tasarım.

## Nasıl kullanılır?

1. [MonFlip’i aç](https://monflip-snowy.vercel.app) ve tarayıcı cüzdanını bağla. Ağ olarak **Monad Testnet** kullanılır; ağ kimliği `10143`.
2. [Faucet üzerinden test MON al](https://faucet.monad.xyz). Ağ ücretleri için cüzdanında bir miktar bırak.
3. Ana ekrandaki **Yatır** düğmesiyle MonFlip işlem bakiyene test MON aktar.
4. Varlığı, süreyi ve işlem tutarını seç.
5. **Yukarı** veya **Aşağı** düğmesine bas ve cüzdanındaki işlemi onayla.
6. Tahminini **Açık işlemler**, sonucunu **Geçmiş** bölümünden takip et. Kullanılabilir bakiyeni **Çek** düğmesiyle cüzdanına geri alabilirsin.

**Mevcut demoyu kullanmak için yeni sözleşme kurmana gerek yok.** `/setup` ekranı, kendi kurulumunu yapmak isteyen proje sahibine yöneliktir.

## Kazanç ve kayıp nasıl hesaplanır?

MonFlip’te kaldıraç yoktur. Doğru tahmin için sabit **%80 net kazanç** uygulanır. İşlem tutarı **0,01–10 test MON** arasındadır.

**1 test MON ile açılan bir işlem örneği:**

| Sonuç | Bakiyene dönen tutar | Net değişim |
| --- | --- | --- |
| Tahmin doğru | 1,80 test MON | +0,80 test MON |
| Tahmin yanlış | 0 test MON | −1 test MON |
| Giriş ve kapanış fiyatı eşit | 1 test MON | 0 |

Kazanç bakiyene eklenir; cüzdanına aktarmak için **Çek** işlemi yaparsın. Ağ işlem ücretleri bu tablodaki tutarlara dahil değildir.

### Kasa nasıl korunur?

Kasa, her kabul edilen işlem için mümkün olan **toplam ödemeyi** ayırır. Kullanıcı bakiyeleri ve açık işlemler için ayrılan tutarlar başka işlemleri finanse etmek için kullanılamaz. Serbest kasa rezervi yetersizse yeni işlem kabul edilmez.

Bu mekanizma kasanın hiç zarar etmeyeceği anlamına gelmez; mevcut işlemlerin ödeme karşılıklarını korur. Sözleşmede kasa çekme veya ayrılmış fonları yöneticiye aktarma işlevi yoktur.

### Üç farklı bakiye

| Bakiye | Ne işe yarar? | Nasıl eklenir? |
| --- | --- | --- |
| Kasa rezervi | Kazanan tahminlerin ödemelerini karşılar | Kurulum sırasında |
| Sonuçlandırma servisi bakiyesi | Sonuçları zincire yazmanın ağ ücretini karşılar | `/setup` ekranındaki servis adresine test MON gönderilerek |
| Kişisel işlem bakiyesi | Kullanıcının tahmin açmasını sağlar | Ana ekrandaki **Yatır** düğmesiyle |

**Kurulumda kasaya gönderdiğin 10 test MON, kişisel işlem bakiyene eklenmez.** İşlem açmak için ayrıca ana ekrandan bakiye yatırmalısın.

## Sistem nasıl çalışıyor?

```text
CoinGecko → Sunucu: referans fiyat ve imzalı teklif
Cüzdan → MonFlip sözleşmesi: tahmin açma ve tutarı ayırma
Süre dolunca → Sonuçlandırma servisi → Sözleşmede sonuç ve bakiye güncellemesi
```

Arayüz Next.js ve React ile, cüzdan bağlantısı viem ile, akıllı sözleşme Solidity ve OpenZeppelin ile geliştirilmiştir. Sunucu fiyatı alır ve imzalar; bakiyeleri ve ödeme kurallarını sözleşme uygular.

### Demo sınırları ve güven modeli

- **Fiyat servisi merkezidir.** CoinGecko verisini imzalayan güvenilir bir servis cüzdanı kullanılır; bu yapı merkeziyetsiz bir oracle değildir.
- Fiyat yanıtları sunucuda 25 saniye önbelleğe alınır; arayüz 30 saniyede bir sorgular. Demo, kaynak zamanı en fazla **10 dakika eski** olan fiyatları kabul eder. Aynı fiyatın tekrar gelmesi iadeyle sonuçlanabilir.
- Grafik CoinGecko’nun son 24 saatlik gerçek verisini yükler. Varsayılan mum görünümünde her mum 30 dakikalık açılış, yüksek, düşük ve kapanış fiyatlarını gösterir. Çizgi görünümü yaklaşık 5 dakikalık fiyat örneklerini canlı sorgu sonuçlarıyla birleştirir. 6/12/24 saat seçimi, yakınlaştırma, sürükleme ve imleçle fiyat okuma desteklenir. Tarihsel veriler 60 saniye önbelleğe alınır; saniyelik veya uydurma fiyat hareketleri kullanılmaz. Grafik zaman aralığı işlem süresinden bağımsızdır.
- Süre, düğmeye basıldığında değil, işlem zincire dahil edildiğinde başlar. Kapanış fiyatı, süre dolduktan sonra sonuçlandırma sırasında alınan gözlemdir; bitiş saniyesindeki kesin tarihsel fiyat garanti edilmez.
- Servis 120 saniyelik ek süre içinde sonuçlandıramazsa `refundExpired` çağrısıyla işlem tutarının tamamı iade edilebilir. Arayüz uygun işlemlerde **İade al** seçeneğini gösterir.
- **Tarayıcının veya bilgisayarının açık kalması gerekmez.** İmzalı teklif verilmeden önce Vercel Workflow işi kaydedilir. İş, cüzdanın işlem sırasını zincirde izler; işlem onaylanınca bitiş zamanına kadar bekler ve otomatik sonuçlandırır. İptal edilen veya kullanılmayan teklifler izlemeyi sonlandırır. Ağ hatalarında yeniden dener; ödeme daha önce yapılmışsa tekrar ödeme yapmaz. Uzun servis kesintilerinde sözleşmenin zaman aşımı iadesi geçerlidir.
- Servis adresi sözleşmede değiştirilemez. Özel anahtar kaybolursa yeni kurulum gerekir. Gecikmeli fiyatlar daha hızlı fiyat kaynaklarıyla istismar edilebilir; bu model gerçek para veya mainnet için tasarlanmamıştır.

## Bilgisayarında çalıştır

**Gerekenler:** Node.js **22.x**, npm ve işlem denemek için bir tarayıcı cüzdanı.

```sh
git clone https://github.com/Saylool/monflip.git
cd monflip
npm ci
cp .env.example .env.local
npm run contracts:compile
npm run dev
```

Ardından [localhost:3000](http://localhost:3000) adresini aç. Sunucu ayarları olmadan fiyat ekranı çalışır; işlem açmak için aşağıdaki kurulum gerekir.

### Ortam değişkenleri

Yerelde `.env.local`, Vercel’de proje ortam değişkenleri kullanılır.

| Değişken | Açıklama |
| --- | --- |
| `ORACLE_PRIVATE_KEY` | Yalnızca bu demo için oluşturulan servis cüzdanının özel anahtarı. İşlem işlevleri için gereklidir. |
| `MONFLIP_CONTRACT` | Kendi kurulumunda dağıttığın MonFlip sözleşmesinin adresi. |
| `COINGECKO_API_KEY` | İsteğe bağlı CoinGecko Demo API anahtarı. |
| `MONAD_RPC_URL` | İsteğe bağlı RPC adresi. Varsayılan: `https://testnet-rpc.monad.xyz`. |

Özel anahtarlar yalnızca sunucuda kalmalıdır. `NEXT_PUBLIC_` öneki kullanma; `.env.local`, özel anahtar veya kurtarma kelimelerini GitHub’a gönderme. Ana cüzdanın yerine ayrı bir testnet servis cüzdanı kullan.

### Kendi testnet kurulumunu etkinleştir

1. Servis cüzdanının anahtarını `ORACLE_PRIVATE_KEY` olarak ayarla ve uygulamayı başlat veya yayınla.
2. `/setup` ekranını aç. Gösterilen servis adresine ağ ücretleri için **0,1 test MON** gönder.
3. Başlangıç kasa rezervini seçerek sözleşmeyi cüzdanında onayla. Varsayılan rezerv **10 test MON**’dur.
4. Dönen sözleşme adresini `MONFLIP_CONTRACT` olarak kaydet; uygulamayı yeniden başlat veya tekrar yayınla.
5. Ana ekrana dönerek **Yatır** üzerinden kişisel işlem bakiyesi ekle.

Kurulum işlemi başarılı oldu ama adres kaybolduysa tekrar kurulum yapma. `/setup` ekranında kurulum işlem kimliğini kullanarak sözleşmeyi geri bulabilirsin.

### Otomatik sonuçlandırma

Vercel dağıtımında Workflow SDK kalıcı işleri çalıştırır; ayrı bilgisayar veya sürekli açık tarayıcı gerekmez. İşler Vercel panelinin Workflows bölümünden izlenebilir. Yerel geliştirmede bu işleri yerel sunucu çalıştırır; bilgisayar kapalıyken devam etme özelliği yayın ortamına aittir. Vercel’in ücretsiz kullanım kotaları geçerlidir.

Alternatif barındırma veya kurtarma için eski bağımsız keeper da kullanılabilir. Gerekli ortam değişkenlerini içeren `.env.local` dosyasıyla çalıştır:

```sh
npm run keeper
```

Bu küçük demo için tek keeper kullan. Birden fazla eşzamanlı servis, aynı cüzdanın işlem sıralamasında çakışma oluşturabilir. Vercel işlevlerindeki önbellek ve işlem sıralama kontrolü her işlev örneğine özeldir; küresel kilit değildir.

## GitHub’dan Vercel’e yayınla

1. Depoyu kendi GitHub hesabına fork et ve [Vercel’e içe aktar](https://vercel.com/new).
2. Framework olarak **Next.js**, Node.js sürümü olarak **22.x**, proje kökü olarak depo kökünü seç. Derleme ve çıktı ayarlarını varsayılan bırak.
3. İşlem işlevleri için sunucu ortam değişkenlerini ekle. İlk yayında servis anahtarıyla başla; `/setup` tamamlandıktan sonra sözleşme adresini ekleyip yeniden yayınla.
4. Git bağlantısı kurulduğunda `main` dalına gönderilen değişiklikler otomatik yayınlanır.

`npm run build`, standart Next.js üretim derlemesini oluşturur. Otomatik sonuçlandırma Vercel Workflow tarafından yürütülür; Vercel üzerinde ayrıca keeper çalıştırmak gerekmez. Depodaki eski `.openai/hosting.json` dosyası önceki yayının kaydıdır; Vercel tarafından kullanılmaz.

## Kontroller

```sh
npm test
npm run typecheck
npm run build
```

Sözleşme testleri yerel bir EVM üzerinde gerçek imzalar ve işlenmiş işlemler kullanır. Kazanma, kaybetme, eşitlik, zaman aşımı iadesi, kasa yetersizliği, eşzamanlı kazançlar, para çekme, tutar sınırları, geçersiz imzalar ve tekrar kullanım saldırıları kontrol edilir. Bu testler bağımsız güvenlik denetimi yerine geçmez.

## Önemli dosyalar

| Dosya / klasör | Görevi |
| --- | --- |
| `app/page.tsx` | İşlem ekranı, dil seçimi ve cüzdan bağlantısı |
| `app/setup/page.tsx` | Kurulum, servis fonlama ve sözleşme kurtarma |
| `app/api/` | Fiyat, yapılandırma, imzalı teklif ve sonuçlandırma uçları |
| `contracts/MonFlip.sol` | Bakiye, kasa, tahmin ve ödeme kuralları |
| `workflows/prediction.ts` | Tarayıcıdan bağımsız kalıcı işlem takibi ve sonuçlandırma |
| `scripts/keeper.mjs` | Bağımsız sonuçlandırma süreci |
| `lib/contract.json` | Derlenmiş sözleşme ABI’si ve dağıtım kodu |

Sözleşme değiştiğinde `npm run contracts:compile` ile derlenmiş dosyayı yeniden oluştur.

## Lisans

Kaynak kod [MIT lisansı](LICENSE) ile paylaşılır.

Grafikler [TradingView Lightweight Charts™](https://www.tradingview.com/) ile oluşturulur. [Üçüncü taraf bildirimi](public/chart-credits.txt).
