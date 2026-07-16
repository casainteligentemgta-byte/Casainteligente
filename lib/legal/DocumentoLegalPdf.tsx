import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type {
  LegalDocumentBlock,
  LegalDocumentStructured,
} from '@/lib/legal/documentoEstructurado';

const st = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 52,
    fontSize: 10,
    fontFamily: 'Times-Roman',
    lineHeight: 1.45,
    color: '#111',
  },
  docTitle: {
    fontSize: 13,
    fontFamily: 'Times-Bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 18,
  },
  title: {
    fontSize: 11,
    fontFamily: 'Times-Bold',
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 10.5,
    fontFamily: 'Times-Bold',
    marginTop: 10,
    marginBottom: 4,
  },
  paragraph: {
    textAlign: 'justify',
    marginBottom: 6,
  },
  clause: {
    textAlign: 'justify',
    marginBottom: 6,
    paddingLeft: 8,
    borderLeftWidth: 1.5,
    borderLeftColor: '#999',
  },
  listItem: {
    marginBottom: 2,
    paddingLeft: 10,
  },
  table: {
    marginVertical: 8,
    borderWidth: 0.75,
    borderColor: '#333',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#333',
  },
  tableCell: {
    flex: 1,
    padding: 4,
    fontSize: 9,
    borderRightWidth: 0.5,
    borderRightColor: '#333',
  },
  tableHeader: {
    fontFamily: 'Times-Bold',
    backgroundColor: '#f0f0f0',
  },
  signature: {
    marginTop: 28,
  },
  signatureLine: {
    width: 180,
    borderTopWidth: 1,
    borderTopColor: '#111',
    marginBottom: 4,
  },
  meta: {
    fontSize: 8,
    color: '#555',
    marginBottom: 10,
    textAlign: 'center',
  },
});

function BlockView({ block }: { block: LegalDocumentBlock }) {
  switch (block.type) {
    case 'title':
      return <Text style={st.title}>{block.content}</Text>;
    case 'subtitle':
      return <Text style={st.subtitle}>{block.content}</Text>;
    case 'paragraph':
      return <Text style={st.paragraph}>{block.content}</Text>;
    case 'clause':
      return <Text style={st.clause}>{block.content}</Text>;
    case 'list':
      return (
        <View>
          {block.content.map((item, i) => (
            <Text key={i} style={st.listItem}>
              • {item}
            </Text>
          ))}
        </View>
      );
    case 'table': {
      const rows = block.content;
      if (!rows.length) return null;
      const keys = Object.keys(rows[0]!);
      return (
        <View style={st.table}>
          <View style={[st.tableRow, st.tableHeader]}>
            {keys.map((k) => (
              <Text key={k} style={[st.tableCell, st.tableHeader]}>
                {k}
              </Text>
            ))}
          </View>
          {rows.map((row, ri) => (
            <View key={ri} style={st.tableRow}>
              {keys.map((k) => (
                <Text key={k} style={st.tableCell}>
                  {String(row[k] ?? '')}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
    }
    case 'signature':
      return (
        <View style={st.signature}>
          <View style={st.signatureLine} />
          <Text>{block.content}</Text>
        </View>
      );
    default:
      return null;
  }
}

export type DocumentoLegalPdfProps = {
  document: LegalDocumentStructured;
  /** Fallback si no hay blocks: texto plano/markdown simplificado. */
  cuerpoFallback?: string | null;
  pie?: string | null;
};

export function DocumentoLegalPdfDocument(props: DocumentoLegalPdfProps) {
  const { document, cuerpoFallback, pie } = props;
  const hasBlocks = (document.blocks?.length ?? 0) > 0;

  return (
    <Document>
      <Page size="A4" style={st.page} wrap>
        <Text style={st.docTitle}>{document.document_title}</Text>
        <Text style={st.meta}>Departamento Legal · Casa Inteligente</Text>
        {hasBlocks ? (
          document.blocks.map((block, i) => <BlockView key={i} block={block} />)
        ) : (
          (cuerpoFallback || '')
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p, i) => (
              <Text key={i} style={st.paragraph}>
                {p.replace(/^#+\s*/, '').replace(/^>\s*/, '')}
              </Text>
            ))
        )}
        {pie ? (
          <Text style={[st.meta, { marginTop: 16 }]}>{pie}</Text>
        ) : null}
      </Page>
    </Document>
  );
}
