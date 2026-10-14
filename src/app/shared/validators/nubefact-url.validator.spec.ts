import { esUrlPdfNubefactValida } from './nubefact-url.validator';

describe('esUrlPdfNubefactValida', () => {
  it('acepta enlaces HTTPS de Nubefact', () => {
    expect(esUrlPdfNubefactValida('https://api.nubefact.com/v1/pdf/123')).toBeTrue();
  });

  it('rechaza protocolos y dominios no autorizados', () => {
    expect(esUrlPdfNubefactValida('javascript:alert(1)')).toBeFalse();
    expect(esUrlPdfNubefactValida('http://nubefact.com/documento.pdf')).toBeFalse();
    expect(esUrlPdfNubefactValida('https://nubefact.com.evil.example/documento.pdf')).toBeFalse();
  });
});
