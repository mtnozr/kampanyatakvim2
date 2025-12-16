export interface Version {
  version: string;
  date: string;
  notes: string[];
}

export const changelog: Version[] = [
  {
    version: 'v1.2.0',
    date: '16.12.2024',
    notes: [
      'feat: Takvim günlerine sağ tıklayarak not (sticky note) ekleme özelliği getirildi.',
      'feat: Eklenen notların takvim üzerinde görsel olarak (ikon) görüntülenmesi sağlandı.',
      'feat: Notların üzerine gelindiğinde detaylı içeriğin tooltip ile gösterilmesi sağlandı.'
    ]
  },
  {
    version: 'v1.1.3',
    date: '16.12.2024',
    notes: [
      'feat: Kampanya ekleme/düzenleme ekranlarında birim listesi alfabetik olarak sıralandı.'
    ]
  },
  {
    version: 'v1.1.2',
    date: '16.12.2024',
    notes: [
      'fix: PDF dışa aktarımında kenar boşlukları azaltılarak takvim alanı genişletildi.',
      'fix: Takvimdeki gün gösterge (mor daire) hizalaması düzeltildi.'
    ]
  },
  {
    version: 'v1.1.1',
    date: '16.12.2024',
    notes: [
      'feat: E-posta konu başlıklarında "ACİL" ifadesi sadece çok yüksek öncelikli görevler için sınırlandırıldı.'
    ]
  },
  {
    version: 'v1.1.0',
    date: '16.12.2024',
    notes: [
      'feat: PDF dışa aktarımında Türkçe karakter sorunları giderildi.',
      'feat: PDF tasarımı kurumsal kimliğe uygun hale getirildi.',
      'feat: Chrome tarayıcısında PDF render sorunları çözüldü.',
      'feat: Site varsayılan zoom oranı %90 olarak ayarlandı.',
      'fix: Header butonlarının mobilde/küçük ekranlarda taşması engellendi.'
    ]
  }
];
